import asyncio
import json
import logging
from collections import defaultdict
from typing import Any, AsyncIterator

logger = logging.getLogger(__name__)


class EventBus:
    """
    Pub/sub event bus backed by Redis.

    Falls back to an in-memory asyncio.Queue implementation when Redis is
    unavailable, so the service keeps working in development or during
    transient Redis outages.
    """

    def __init__(self):
        # In-memory fallback structures (always present)
        self._subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)
        self._redis_available: bool = False
        self._pubsub_tasks: dict[str, asyncio.Task] = {}

    # ------------------------------------------------------------------
    # Redis helpers
    # ------------------------------------------------------------------

    def _get_redis(self):
        """Return the Redis client from the global pool, or None."""
        try:
            from app.core.redis import redis_pool
            return redis_pool.client
        except Exception:
            return None

    async def _ensure_redis(self) -> bool:
        """Check whether Redis is usable. Cache the result."""
        redis = self._get_redis()
        if redis is None:
            self._redis_available = False
            return False
        try:
            await redis.ping()
            self._redis_available = True
            return True
        except Exception:
            self._redis_available = False
            return False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def publish(self, channel: str, event: dict[str, Any]) -> None:
        """Publish an event to all subscribers on *channel*."""
        # Try Redis first
        if self._redis_available or await self._ensure_redis():
            try:
                redis = self._get_redis()
                if redis is not None:
                    await redis.publish(channel, json.dumps(event))
                    return
            except Exception as exc:
                logger.warning(
                    "Redis publish failed for channel %s, falling back to in-memory: %s",
                    channel,
                    exc,
                )
                self._redis_available = False

        # Fallback: in-memory fan-out
        queues = self._subscribers.get(channel, [])
        for queue in queues:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning(
                    "Event queue full for channel %s, dropping event", channel
                )

    async def subscribe(self, channel: str) -> AsyncIterator[dict[str, Any]]:
        """
        Yield events from *channel* as they arrive.

        Uses a Redis pubsub subscription when Redis is available, otherwise
        falls back to an in-memory asyncio.Queue.
        """
        # Try Redis-backed subscription
        if self._redis_available or await self._ensure_redis():
            try:
                async for event in self._redis_subscribe(channel):
                    yield event
                return
            except Exception as exc:
                logger.warning(
                    "Redis subscribe failed for channel %s, falling back to in-memory: %s",
                    channel,
                    exc,
                )
                self._redis_available = False

        # Fallback: in-memory queue
        async for event in self._memory_subscribe(channel):
            yield event

    async def close_channel(self, channel: str) -> None:
        """Signal all subscribers on *channel* to stop."""
        # Close in-memory queues
        queues = self._subscribers.get(channel, [])
        for queue in queues:
            try:
                queue.put_nowait(None)
            except asyncio.QueueFull:
                pass

        # Publish a sentinel via Redis so remote subscribers also stop
        if self._redis_available or await self._ensure_redis():
            try:
                redis = self._get_redis()
                if redis is not None:
                    sentinel = json.dumps({"__close__": True})
                    await redis.publish(channel, sentinel)
            except Exception as exc:
                logger.warning(
                    "Redis close_channel publish failed for %s: %s",
                    channel,
                    exc,
                )

    # ------------------------------------------------------------------
    # Internal subscription implementations
    # ------------------------------------------------------------------

    async def _redis_subscribe(
        self, channel: str
    ) -> AsyncIterator[dict[str, Any]]:
        """Subscribe via Redis pubsub and yield parsed events."""
        redis = self._get_redis()
        if redis is None:
            return

        pubsub = redis.pubsub()
        await pubsub.subscribe(channel)
        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    data = json.loads(message["data"])
                except (json.JSONDecodeError, TypeError):
                    continue

                # Sentinel event signals channel closure
                if isinstance(data, dict) and data.get("__close__"):
                    break

                yield data
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()

    async def _memory_subscribe(
        self, channel: str
    ) -> AsyncIterator[dict[str, Any]]:
        """Subscribe via an in-memory asyncio.Queue."""
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._subscribers[channel].append(queue)
        try:
            while True:
                event = await queue.get()
                if event is None:
                    break
                yield event
        finally:
            self._subscribers[channel].remove(queue)
            if not self._subscribers[channel]:
                del self._subscribers[channel]


event_bus = EventBus()
