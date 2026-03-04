from fastapi import APIRouter

from app.core.database import db_pool

router = APIRouter(tags=["metrics"])


@router.get("/metrics")
async def get_metrics():
    total = await db_pool.fetchval("SELECT COUNT(*) FROM agent_executions")
    running = await db_pool.fetchval(
        "SELECT COUNT(*) FROM agent_executions WHERE status = 'RUNNING'"
    )
    completed = await db_pool.fetchval(
        "SELECT COUNT(*) FROM agent_executions WHERE status = 'COMPLETED'"
    )
    failed = await db_pool.fetchval(
        "SELECT COUNT(*) FROM agent_executions WHERE status = 'FAILED'"
    )

    avg_duration = await db_pool.fetchval(
        """
        SELECT EXTRACT(EPOCH FROM AVG(completed_at - started_at))
        FROM agent_executions
        WHERE status = 'COMPLETED' AND started_at IS NOT NULL AND completed_at IS NOT NULL
        """
    )

    by_agent = await db_pool.fetch(
        """
        SELECT agent_type, status, COUNT(*) as count
        FROM agent_executions
        GROUP BY agent_type, status
        ORDER BY agent_type
        """
    )

    return {
        "total_executions": total or 0,
        "running": running or 0,
        "completed": completed or 0,
        "failed": failed or 0,
        "error_rate": round(failed / total * 100, 2) if total else 0,
        "avg_duration_seconds": round(float(avg_duration), 2) if avg_duration else None,
        "by_agent": [dict(r) for r in by_agent],
    }
