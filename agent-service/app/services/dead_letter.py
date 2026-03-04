import json
import logging
import uuid
from typing import Any, Optional

from app.core.database import db_pool

logger = logging.getLogger(__name__)


class DeadLetterStore:
    async def add(
        self,
        agent_type: str,
        execution_id: str,
        input_data: dict[str, Any],
        error_message: str,
    ) -> str:
        job_id = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO dead_letter_jobs
                (id, agent_type, execution_id, input_data, error_message, attempt_count, created_at, updated_at)
            VALUES ($1, $2, $3, $4::jsonb, $5, 1, NOW(), NOW())
            """,
            job_id,
            agent_type,
            execution_id,
            json.dumps(input_data),
            error_message,
        )
        logger.warning("Dead letter job created: %s for agent %s", job_id, agent_type)
        return job_id

    async def list_jobs(self, limit: int = 50) -> list[dict]:
        rows = await db_pool.fetch(
            """
            SELECT id, agent_type, execution_id, input_data, error_message, attempt_count, created_at
            FROM dead_letter_jobs
            ORDER BY created_at DESC
            LIMIT $1
            """,
            limit,
        )
        return [dict(r) for r in rows]

    async def get_job(self, job_id: str) -> Optional[dict]:
        row = await db_pool.fetchrow(
            "SELECT * FROM dead_letter_jobs WHERE id = $1",
            job_id,
        )
        return dict(row) if row else None

    async def retry_job(self, job_id: str) -> Optional[str]:
        job = await self.get_job(job_id)
        if not job:
            return None

        await db_pool.execute(
            """
            UPDATE dead_letter_jobs
            SET attempt_count = attempt_count + 1, updated_at = NOW()
            WHERE id = $1
            """,
            job_id,
        )
        return job["execution_id"]

    async def delete_job(self, job_id: str) -> bool:
        result = await db_pool.execute(
            "DELETE FROM dead_letter_jobs WHERE id = $1",
            job_id,
        )
        return "DELETE 1" in str(result)


dead_letter_store = DeadLetterStore()
