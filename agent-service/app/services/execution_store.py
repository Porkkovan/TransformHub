import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from app.core.database import db_pool


class ExecutionStore:
    async def create(
        self,
        agent_type: str,
        input_data: dict[str, Any],
        repository_id: Optional[str] = None,
    ) -> str:
        execution_id = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO agent_executions (id, agent_type, status, input, repository_id, created_at, updated_at)
            VALUES ($1, $2, 'PENDING', $3::jsonb, $4, NOW(), NOW())
            """,
            execution_id,
            agent_type,
            json.dumps(input_data),
            repository_id,
        )
        return execution_id

    async def mark_running(self, execution_id: str):
        await db_pool.execute(
            """
            UPDATE agent_executions
            SET status = 'RUNNING', started_at = NOW(), updated_at = NOW()
            WHERE id = $1
            """,
            execution_id,
        )

    async def mark_completed(self, execution_id: str, output: dict[str, Any]):
        await db_pool.execute(
            """
            UPDATE agent_executions
            SET status = 'COMPLETED', output = $2::jsonb, completed_at = NOW(), updated_at = NOW()
            WHERE id = $1
            """,
            execution_id,
            json.dumps(output),
        )

    async def mark_failed(self, execution_id: str, error_message: str):
        await db_pool.execute(
            """
            UPDATE agent_executions
            SET status = 'FAILED', error_message = $2, completed_at = NOW(), updated_at = NOW()
            WHERE id = $1
            """,
            execution_id,
            error_message,
        )

    async def get_status(self, execution_id: str) -> Optional[dict]:
        row = await db_pool.fetchrow(
            """
            SELECT id, agent_type, status, started_at, completed_at, error_message
            FROM agent_executions WHERE id = $1
            """,
            execution_id,
        )
        return dict(row) if row else None

    async def get_results(self, execution_id: str) -> Optional[dict]:
        row = await db_pool.fetchrow(
            """
            SELECT id, agent_type, status, output, error_message
            FROM agent_executions WHERE id = $1
            """,
            execution_id,
        )
        if not row:
            return None
        result = dict(row)
        if result["output"] and isinstance(result["output"], str):
            result["output"] = json.loads(result["output"])
        return result


execution_store = ExecutionStore()
