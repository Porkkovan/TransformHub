"""
Redis pub/sub AgentCommunicationBus for real-time cross-agent messaging.

Agents can share insights (e.g. risk findings, architecture decisions) that
other agents subscribe to and incorporate into their analysis.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from app.core.redis import redis_pool

logger = logging.getLogger(__name__)

# Channel naming convention:  agent_comms:{agent_type}
_CHANNEL_PREFIX = "agent_comms"


class AgentCommunicationBus:
    """
    Redis-backed pub/sub bus for agent-to-agent communication.

    Usage::

        # Producer agent (e.g. risk_compliance)
        await agent_comms.share_insight(
            agent_type="risk_compliance",
            insight_type="critical_risk_found",
            data={"entity": "payments-service", "score": 9.2},
        )

        # Consumer agent (e.g. fiduciary)
        async for insight in agent_comms.subscribe_to("risk_compliance"):
            print(insight)
    """

    # ------------------------------------------------------------------
    # Publishing
    # ------------------------------------------------------------------

    async def share_insight(
        self,
        agent_type: str,
        insight_type: str,
        data: dict[str, Any],
        *,
        execution_id: str | None = None,
    ) -> int:
        """Publish an insight on the agent's channel.

        Parameters
        ----------
        agent_type:
            The agent publishing the insight (used as channel suffix).
        insight_type:
            A short descriptor, e.g. ``"critical_risk_found"``.
        data:
            Arbitrary JSON-serialisable payload.
        execution_id:
            Optional pipeline execution context.

        Returns
        -------
        int
            Number of subscribers that received the message.
        """
        channel = f"{_CHANNEL_PREFIX}:{agent_type}"
        message = json.dumps({
            "agent_type": agent_type,
            "insight_type": insight_type,
            "data": data,
            "execution_id": execution_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        client = redis_pool.client
        receivers = await client.publish(channel, message)
        logger.debug(
            "Published insight '%s' on channel '%s' (%d receivers)",
            insight_type,
            channel,
            receivers,
        )
        return receivers

    # ------------------------------------------------------------------
    # Subscribing
    # ------------------------------------------------------------------

    async def subscribe_to(
        self,
        agent_type: str,
        *,
        timeout: float | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Yield insights published by ``agent_type`` as they arrive.

        Parameters
        ----------
        agent_type:
            The agent whose channel to listen on.
        timeout:
            If set, stop listening after this many seconds of inactivity.

        Yields
        ------
        dict
            Each decoded insight payload.
        """
        channel_name = f"{_CHANNEL_PREFIX}:{agent_type}"
        client = redis_pool.client
        pubsub = client.pubsub()

        try:
            await pubsub.subscribe(channel_name)
            logger.debug("Subscribed to channel '%s'", channel_name)

            while True:
                try:
                    message = await asyncio.wait_for(
                        pubsub.get_message(
                            ignore_subscribe_messages=True,
                            timeout=1.0,
                        ),
                        timeout=timeout,
                    )
                except asyncio.TimeoutError:
                    logger.debug("Subscription timeout on '%s'", channel_name)
                    break

                if message is None:
                    await asyncio.sleep(0.05)
                    continue

                if message["type"] == "message":
                    raw = message["data"]
                    if isinstance(raw, bytes):
                        raw = raw.decode("utf-8")
                    try:
                        payload = json.loads(raw)
                        yield payload
                    except json.JSONDecodeError:
                        logger.warning(
                            "Non-JSON message on '%s': %s", channel_name, raw
                        )
        finally:
            await pubsub.unsubscribe(channel_name)
            await pubsub.aclose()

    # ------------------------------------------------------------------
    # Multi-agent subscription
    # ------------------------------------------------------------------

    async def subscribe_to_many(
        self,
        agent_types: list[str],
        *,
        timeout: float | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Subscribe to multiple agent channels simultaneously.

        Yields insights from any of the specified agents.
        """
        channels = [f"{_CHANNEL_PREFIX}:{at}" for at in agent_types]
        client = redis_pool.client
        pubsub = client.pubsub()

        try:
            await pubsub.subscribe(*channels)
            logger.debug("Subscribed to channels: %s", channels)

            while True:
                try:
                    message = await asyncio.wait_for(
                        pubsub.get_message(
                            ignore_subscribe_messages=True,
                            timeout=1.0,
                        ),
                        timeout=timeout,
                    )
                except asyncio.TimeoutError:
                    break

                if message is None:
                    await asyncio.sleep(0.05)
                    continue

                if message["type"] == "message":
                    raw = message["data"]
                    if isinstance(raw, bytes):
                        raw = raw.decode("utf-8")
                    try:
                        yield json.loads(raw)
                    except json.JSONDecodeError:
                        logger.warning("Non-JSON message: %s", raw)
        finally:
            await pubsub.unsubscribe(*channels)
            await pubsub.aclose()

    # ------------------------------------------------------------------
    # Broadcast to all agents
    # ------------------------------------------------------------------

    async def broadcast(
        self,
        insight_type: str,
        data: dict[str, Any],
        *,
        execution_id: str | None = None,
    ) -> None:
        """Publish an insight on the global broadcast channel."""
        await self.share_insight(
            agent_type="__broadcast__",
            insight_type=insight_type,
            data=data,
            execution_id=execution_id,
        )


# Module-level singleton
agent_comms = AgentCommunicationBus()
