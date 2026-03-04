import json
import logging
from typing import Any, Optional

from app.core.redis import redis_pool

logger = logging.getLogger(__name__)

DEFAULT_TTL = 300  # 5 minutes


class CacheService:
    def __init__(self, prefix: str = "cache"):
        self._prefix = prefix

    def _key(self, key: str) -> str:
        return f"{self._prefix}:{key}"

    async def get_json(self, key: str) -> Optional[Any]:
        try:
            raw = await redis_pool.client.get(self._key(key))
            if raw is None:
                return None
            return json.loads(raw)
        except Exception as e:
            logger.warning("Cache get failed for %s: %s", key, e)
            return None

    async def set_json(self, key: str, value: Any, ttl: int = DEFAULT_TTL) -> None:
        try:
            await redis_pool.client.set(
                self._key(key),
                json.dumps(value, default=str),
                ex=ttl,
            )
        except Exception as e:
            logger.warning("Cache set failed for %s: %s", key, e)

    async def invalidate(self, key: str) -> None:
        try:
            await redis_pool.client.delete(self._key(key))
        except Exception as e:
            logger.warning("Cache invalidate failed for %s: %s", key, e)

    async def invalidate_pattern(self, pattern: str) -> None:
        try:
            cursor = None
            while cursor != 0:
                cursor, keys = await redis_pool.client.scan(
                    cursor=cursor or 0,
                    match=self._key(pattern),
                    count=100,
                )
                if keys:
                    await redis_pool.client.delete(*keys)
        except Exception as e:
            logger.warning("Cache invalidate_pattern failed for %s: %s", pattern, e)


cache_service = CacheService()
