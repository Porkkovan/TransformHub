import os
from typing import Optional

import redis.asyncio as aioredis


class RedisPool:
    def __init__(self):
        self._pool: Optional[aioredis.Redis] = None

    async def connect(self):
        import logging
        url = os.environ.get("REDIS_URL", "redis://localhost:6379")
        try:
            self._pool = aioredis.from_url(
                url,
                encoding="utf-8",
                decode_responses=True,
                max_connections=20,
            )
            await self._pool.ping()
            logging.getLogger(__name__).info("Redis connected at %s", url)
        except Exception as exc:
            logging.getLogger(__name__).warning(
                "Redis unavailable (%s) — running with in-memory fallback", exc
            )
            self._pool = None

    async def disconnect(self):
        if self._pool:
            await self._pool.aclose()

    @property
    def client(self) -> Optional[aioredis.Redis]:
        return self._pool


redis_pool = RedisPool()
