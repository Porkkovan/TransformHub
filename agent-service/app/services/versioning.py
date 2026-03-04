import hashlib
import json
import logging
from typing import Any, Optional

from app.core.database import db_pool

logger = logging.getLogger(__name__)


def compute_hash(data: Any) -> str:
    serialized = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode()).hexdigest()[:16]


class VersioningService:
    async def register_version(
        self,
        agent_type: str,
        prompts: dict[str, str],
        graph_structure: list[str],
    ) -> dict:
        prompt_hash = compute_hash(prompts)
        graph_hash = compute_hash(graph_structure)

        existing = await db_pool.fetchrow(
            """
            SELECT id, version FROM agent_versions
            WHERE agent_type = $1 AND prompt_hash = $2 AND graph_hash = $3
            """,
            agent_type,
            prompt_hash,
            graph_hash,
        )

        if existing:
            return {"id": existing["id"], "version": existing["version"], "new": False}

        current_max = await db_pool.fetchval(
            "SELECT COALESCE(MAX(version), 0) FROM agent_versions WHERE agent_type = $1",
            agent_type,
        )
        new_version = current_max + 1

        # Deactivate old versions
        await db_pool.execute(
            "UPDATE agent_versions SET is_active = FALSE WHERE agent_type = $1",
            agent_type,
        )

        import uuid
        version_id = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO agent_versions (id, agent_type, version, prompt_hash, graph_hash, is_active, created_at)
            VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
            """,
            version_id,
            agent_type,
            new_version,
            prompt_hash,
            graph_hash,
        )

        logger.info("Registered new version %d for agent %s", new_version, agent_type)
        return {"id": version_id, "version": new_version, "new": True}

    async def get_active_version(self, agent_type: str) -> Optional[dict]:
        row = await db_pool.fetchrow(
            """
            SELECT id, agent_type, version, prompt_hash, graph_hash, created_at
            FROM agent_versions
            WHERE agent_type = $1 AND is_active = TRUE
            """,
            agent_type,
        )
        return dict(row) if row else None

    async def list_versions(self, agent_type: str) -> list[dict]:
        rows = await db_pool.fetch(
            """
            SELECT id, agent_type, version, prompt_hash, graph_hash, is_active, created_at
            FROM agent_versions
            WHERE agent_type = $1
            ORDER BY version DESC
            """,
            agent_type,
        )
        return [dict(r) for r in rows]


versioning_service = VersioningService()
