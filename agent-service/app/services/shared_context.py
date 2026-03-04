"""
SharedContextStore for cross-agent data sharing within a pipeline execution.

Uses Redis hashes for fast in-flight reads and PostgreSQL for durable persistence.
Each key is namespaced by ``execution_id`` so concurrent pipelines never collide.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from app.core.database import db_pool
from app.core.redis import redis_pool

logger = logging.getLogger(__name__)

_REDIS_KEY_PREFIX = "shared_ctx"
_REDIS_TTL_SECONDS = 3600 * 6  # 6-hour TTL for in-flight context


class SharedContextStore:
    """
    Dual-write context store: Redis hash for low-latency lookups, PostgreSQL
    ``shared_context`` table for persistence beyond the Redis TTL.

    Usage::

        from app.services.shared_context import shared_context

        # Write from one agent
        await shared_context.set(execution_id, "risk_scores", risk_payload)

        # Read from another agent
        scores = await shared_context.get(execution_id, "risk_scores")

        # Get everything for an execution
        all_ctx = await shared_context.get_all(execution_id)
    """

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _redis_key(execution_id: str) -> str:
        return f"{_REDIS_KEY_PREFIX}:{execution_id}"

    @staticmethod
    def _serialize(value: Any) -> str:
        return json.dumps(value, default=str)

    @staticmethod
    def _deserialize(raw: str | bytes | None) -> Any:
        if raw is None:
            return None
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return raw

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def set(
        self,
        execution_id: str,
        key: str,
        value: Any,
    ) -> None:
        """Store a key-value pair for the given execution.

        Writes to both Redis (for speed) and PostgreSQL (for durability).
        """
        serialized = self._serialize(value)

        # Redis hash set
        redis_key = self._redis_key(execution_id)
        try:
            client = redis_pool.client
            await client.hset(redis_key, key, serialized)
            await client.expire(redis_key, _REDIS_TTL_SECONDS)
        except Exception as exc:
            logger.warning("Redis write failed for shared context %s/%s: %s", execution_id, key, exc)

        # PostgreSQL upsert
        try:
            await db_pool.execute(
                """
                INSERT INTO shared_context (execution_id, key, value, updated_at)
                VALUES ($1, $2, $3::jsonb, NOW())
                ON CONFLICT (execution_id, key) DO UPDATE
                    SET value = $3::jsonb, updated_at = NOW()
                """,
                execution_id,
                key,
                serialized,
            )
        except Exception as exc:
            logger.error("PostgreSQL write failed for shared context %s/%s: %s", execution_id, key, exc)

        logger.debug("Shared context set: %s/%s", execution_id, key)

    async def get(
        self,
        execution_id: str,
        key: str,
    ) -> Optional[Any]:
        """Retrieve a value from shared context, trying Redis first.

        Falls back to PostgreSQL if Redis misses.
        """
        # Try Redis first
        try:
            client = redis_pool.client
            raw = await client.hget(self._redis_key(execution_id), key)
            if raw is not None:
                return self._deserialize(raw)
        except Exception as exc:
            logger.warning("Redis read failed for shared context %s/%s: %s", execution_id, key, exc)

        # Fall back to PostgreSQL
        try:
            row = await db_pool.fetchrow(
                """
                SELECT value FROM shared_context
                WHERE execution_id = $1 AND key = $2
                """,
                execution_id,
                key,
            )
            if row:
                value = row["value"]
                if isinstance(value, str):
                    return self._deserialize(value)
                return value
        except Exception as exc:
            logger.error("PostgreSQL read failed for shared context %s/%s: %s", execution_id, key, exc)

        return None

    async def get_all(
        self,
        execution_id: str,
    ) -> dict[str, Any]:
        """Return all key-value pairs for a pipeline execution.

        Reads from Redis first; if empty, falls back to PostgreSQL.
        """
        result: dict[str, Any] = {}

        # Try Redis
        try:
            client = redis_pool.client
            raw_all = await client.hgetall(self._redis_key(execution_id))
            if raw_all:
                for k, v in raw_all.items():
                    result[k] = self._deserialize(v)
                return result
        except Exception as exc:
            logger.warning("Redis hgetall failed for %s: %s", execution_id, exc)

        # Fall back to PostgreSQL
        try:
            rows = await db_pool.fetch(
                """
                SELECT key, value FROM shared_context
                WHERE execution_id = $1
                ORDER BY key
                """,
                execution_id,
            )
            for row in rows:
                val = row["value"]
                result[row["key"]] = self._deserialize(val) if isinstance(val, str) else val
        except Exception as exc:
            logger.error("PostgreSQL fetch failed for shared context %s: %s", execution_id, exc)

        return result

    async def delete(
        self,
        execution_id: str,
        key: str,
    ) -> None:
        """Remove a specific key from shared context."""
        try:
            client = redis_pool.client
            await client.hdel(self._redis_key(execution_id), key)
        except Exception as exc:
            logger.warning("Redis delete failed for shared context %s/%s: %s", execution_id, key, exc)

        try:
            await db_pool.execute(
                "DELETE FROM shared_context WHERE execution_id = $1 AND key = $2",
                execution_id,
                key,
            )
        except Exception as exc:
            logger.error("PostgreSQL delete failed for shared context %s/%s: %s", execution_id, key, exc)

    async def clear(
        self,
        execution_id: str,
    ) -> None:
        """Remove all shared context entries for an execution."""
        try:
            client = redis_pool.client
            await client.delete(self._redis_key(execution_id))
        except Exception as exc:
            logger.warning("Redis clear failed for shared context %s: %s", execution_id, exc)

        try:
            await db_pool.execute(
                "DELETE FROM shared_context WHERE execution_id = $1",
                execution_id,
            )
        except Exception as exc:
            logger.error("PostgreSQL clear failed for shared context %s: %s", execution_id, exc)


# Module-level singleton
shared_context = SharedContextStore()
