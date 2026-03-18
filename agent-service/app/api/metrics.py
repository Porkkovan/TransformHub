from fastapi import APIRouter, Query

from app.core.database import db_pool
from app.services.circuit_breaker import get_all_stats as get_breaker_stats
from app.services.llm_router import llm_router
from app.services.ab_testing import ab_test

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

    # Error rate per agent type in last 24h
    error_rates_24h = await db_pool.fetch(
        """
        SELECT agent_type,
               COUNT(*) FILTER (WHERE status = 'FAILED')::FLOAT / NULLIF(COUNT(*), 0) * 100 AS error_pct,
               COUNT(*) AS total
        FROM agent_executions
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY agent_type
        ORDER BY error_pct DESC NULLS LAST
        """
    )

    # P95 execution duration per agent type
    p95_durations = await db_pool.fetch(
        """
        SELECT agent_type,
               PERCENTILE_CONT(0.95) WITHIN GROUP (
                 ORDER BY EXTRACT(EPOCH FROM (completed_at - started_at))
               ) AS p95_seconds
        FROM agent_executions
        WHERE status = 'COMPLETED'
          AND started_at IS NOT NULL
          AND completed_at IS NOT NULL
          AND created_at > NOW() - INTERVAL '7 days'
        GROUP BY agent_type
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
        "error_rates_24h": [dict(r) for r in error_rates_24h],
        "p95_duration_seconds_7d": [dict(r) for r in p95_durations],
        "circuit_breakers": get_breaker_stats(),
        "llm_usage_session": llm_router.get_usage(),
        "ab_experiments": ab_test.get_experiment_summary(),
    }


@router.get("/metrics/budget/{org_id}")
async def get_org_budget(org_id: str):
    """Return current LLM usage vs budget for an organisation."""
    from app.services.budget_enforcement import budget_enforcer
    return await budget_enforcer.get_usage_summary(org_id)


@router.get("/metrics/budget/{org_id}/history")
async def get_org_budget_history(
    org_id: str,
    days: int = Query(default=30, ge=1, le=365),
):
    """Return daily LLM cost breakdown for the last N days."""
    rows = await db_pool.fetch(
        """
        SELECT
            DATE_TRUNC('day', created_at) AS day,
            agent_type,
            model,
            SUM(input_tokens + output_tokens) AS total_tokens,
            SUM(cost_usd)                      AS total_cost_usd
        FROM org_llm_usage
        WHERE organization_id = $1
          AND created_at > NOW() - ($2 || ' days')::INTERVAL
        GROUP BY 1, 2, 3
        ORDER BY 1 DESC, 5 DESC
        """,
        org_id,
        str(days),
    )
    return [dict(r) for r in rows]
