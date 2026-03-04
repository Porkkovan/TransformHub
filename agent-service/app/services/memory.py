"""
Agent memory service for persisting and recalling learned context.

Memories are stored in PostgreSQL and ranked by ``confidence * access_count``
so that frequently accessed, high-confidence memories surface first.
A decay function gradually reduces confidence on old, unused memories.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from app.core.database import db_pool

logger = logging.getLogger(__name__)


class MemoryService:
    """Persistent agent memory backed by PostgreSQL."""

    # ------------------------------------------------------------------
    # Store
    # ------------------------------------------------------------------

    async def store(
        self,
        agent_type: str,
        org_id: str,
        memory_type: str,
        key: str,
        value: Any,
        confidence: float = 1.0,
    ) -> str:
        """Store a memory entry.

        Parameters
        ----------
        agent_type:
            The agent that owns this memory (e.g. ``"discovery"``).
        org_id:
            Organization scope.
        memory_type:
            Category of memory: ``"correction"``, ``"preference"``,
            ``"learned_pattern"``, ``"context"``, etc.
        key:
            A short human-readable key for lookup.
        value:
            Arbitrary JSON-serialisable payload.
        confidence:
            Initial confidence score between 0.0 and 1.0.

        Returns
        -------
        str
            The memory ID.
        """
        memory_id = str(uuid.uuid4())
        confidence = max(0.0, min(1.0, confidence))

        # Upsert: if the same (agent_type, org_id, key) exists, update it
        existing = await db_pool.fetchrow(
            """
            SELECT id FROM agent_memories
            WHERE agent_type = $1 AND org_id = $2 AND key = $3
            """,
            agent_type,
            org_id,
            key,
        )

        if existing:
            await db_pool.execute(
                """
                UPDATE agent_memories
                SET value = $2::jsonb,
                    confidence = $3,
                    memory_type = $4,
                    access_count = access_count + 1,
                    updated_at = NOW()
                WHERE id = $1
                """,
                existing["id"],
                json.dumps(value, default=str),
                confidence,
                memory_type,
            )
            logger.info("Memory updated: id=%s key=%s", existing["id"], key)
            return existing["id"]

        await db_pool.execute(
            """
            INSERT INTO agent_memories
                (id, agent_type, org_id, memory_type, key, value, confidence,
                 access_count, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, 1, NOW(), NOW())
            """,
            memory_id,
            agent_type,
            org_id,
            memory_type,
            key,
            json.dumps(value, default=str),
            confidence,
        )
        logger.info("Memory stored: id=%s agent=%s key=%s", memory_id, agent_type, key)
        return memory_id

    # ------------------------------------------------------------------
    # Recall
    # ------------------------------------------------------------------

    async def recall(
        self,
        agent_type: str,
        org_id: str,
        memory_type: Optional[str] = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """Retrieve memories sorted by ``confidence * access_count`` descending.

        Optionally filter by ``memory_type``.  Each recall bumps
        ``access_count`` for the returned memories.
        """
        if memory_type:
            rows = await db_pool.fetch(
                """
                SELECT id, agent_type, org_id, memory_type, key, value,
                       confidence, access_count, created_at, updated_at
                FROM agent_memories
                WHERE agent_type = $1 AND org_id = $2 AND memory_type = $3
                ORDER BY (confidence * access_count) DESC
                LIMIT $4
                """,
                agent_type,
                org_id,
                memory_type,
                limit,
            )
        else:
            rows = await db_pool.fetch(
                """
                SELECT id, agent_type, org_id, memory_type, key, value,
                       confidence, access_count, created_at, updated_at
                FROM agent_memories
                WHERE agent_type = $1 AND org_id = $2
                ORDER BY (confidence * access_count) DESC
                LIMIT $3
                """,
                agent_type,
                org_id,
                limit,
            )

        memories = []
        ids: list[str] = []
        for row in rows:
            entry = dict(row)
            if isinstance(entry.get("value"), str):
                try:
                    entry["value"] = json.loads(entry["value"])
                except json.JSONDecodeError:
                    pass
            memories.append(entry)
            ids.append(entry["id"])

        # Bump access counts in the background
        if ids:
            placeholders = ", ".join(f"${i + 1}" for i in range(len(ids)))
            await db_pool.execute(
                f"""
                UPDATE agent_memories
                SET access_count = access_count + 1, updated_at = NOW()
                WHERE id IN ({placeholders})
                """,
                *ids,
            )

        return memories

    # ------------------------------------------------------------------
    # Recall by key
    # ------------------------------------------------------------------

    async def recall_by_key(
        self,
        agent_type: str,
        org_id: str,
        key: str,
    ) -> Optional[dict[str, Any]]:
        """Retrieve a single memory by its unique key."""
        row = await db_pool.fetchrow(
            """
            SELECT id, agent_type, org_id, memory_type, key, value,
                   confidence, access_count, created_at, updated_at
            FROM agent_memories
            WHERE agent_type = $1 AND org_id = $2 AND key = $3
            """,
            agent_type,
            org_id,
            key,
        )

        if not row:
            return None

        # Bump access count
        await db_pool.execute(
            """
            UPDATE agent_memories
            SET access_count = access_count + 1, updated_at = NOW()
            WHERE id = $1
            """,
            row["id"],
        )

        entry = dict(row)
        if isinstance(entry.get("value"), str):
            try:
                entry["value"] = json.loads(entry["value"])
            except json.JSONDecodeError:
                pass

        return entry

    # ------------------------------------------------------------------
    # Decay
    # ------------------------------------------------------------------

    async def decay_confidence(
        self,
        days_threshold: int = 30,
        decay_factor: float = 0.95,
        min_confidence: float = 0.1,
    ) -> int:
        """Reduce confidence of memories not accessed within ``days_threshold`` days.

        Returns the number of memories affected.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=days_threshold)

        result = await db_pool.execute(
            """
            UPDATE agent_memories
            SET confidence = GREATEST($3, confidence * $2),
                updated_at = NOW()
            WHERE updated_at < $1
              AND confidence > $3
            """,
            cutoff,
            decay_factor,
            min_confidence,
        )

        # Parse the "UPDATE N" result
        affected = 0
        if result:
            parts = str(result).split()
            if len(parts) >= 2 and parts[1].isdigit():
                affected = int(parts[1])

        logger.info(
            "Memory decay: %d memories decayed (threshold=%d days, factor=%.2f)",
            affected,
            days_threshold,
            decay_factor,
        )
        return affected


# Module-level singleton
memory_service = MemoryService()
