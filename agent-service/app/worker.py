"""arq worker entry point: python -m app.worker"""

import asyncio
import logging
from typing import Any

from arq import cron
from arq.connections import RedisSettings

from app.core.database import db_pool
from app.core.redis import redis_pool
from app.core.logging import setup_logging
from app.agents.orchestrator import run_agent
from app.services.execution_store import execution_store
from app.services.event_bus import event_bus
from app.services.retry import RetryPolicy, execute_with_retry
from app.services.dead_letter import dead_letter_store
from app.services.queue import get_redis_settings
from app.services.memory_pruning import prune_agent_memories

logger = logging.getLogger(__name__)


async def execute_agent_job(
    ctx: dict,
    execution_id: str,
    agent_type: str,
    input_data: dict[str, Any],
) -> dict[str, Any]:
    channel = f"execution:{execution_id}"
    retry_policy = RetryPolicy()

    try:
        await execution_store.mark_running(execution_id)
        await event_bus.publish(channel, {
            "type": "status",
            "status": "RUNNING",
            "agent_type": agent_type,
            "execution_id": execution_id,
        })

        result = await execute_with_retry(
            retry_policy,
            run_agent,
            agent_type,
            input_data,
        )

        await execution_store.mark_completed(execution_id, result)
        await event_bus.publish(channel, {
            "type": "completed",
            "status": "COMPLETED",
            "execution_id": execution_id,
            "output": result,
        })
        return result

    except Exception as e:
        await execution_store.mark_failed(execution_id, str(e))
        await event_bus.publish(channel, {
            "type": "error",
            "status": "FAILED",
            "execution_id": execution_id,
            "error": str(e),
        })
        await dead_letter_store.add(
            agent_type=agent_type,
            execution_id=execution_id,
            input_data=input_data,
            error_message=str(e),
        )
        raise
    finally:
        await event_bus.close_channel(channel)


async def startup(ctx: dict) -> None:
    setup_logging()
    await db_pool.connect()
    await redis_pool.connect()
    logger.info("Worker started")


async def shutdown(ctx: dict) -> None:
    await redis_pool.disconnect()
    await db_pool.disconnect()
    logger.info("Worker stopped")


async def scheduled_memory_prune(ctx: dict) -> None:
    """Weekly task: prune stale / excess agent memories."""
    try:
        result = await prune_agent_memories()
        logger.info("Memory prune complete: %s", result)
    except Exception as exc:
        logger.error("Scheduled memory prune failed: %s", exc)


async def scheduled_period_reset(ctx: dict) -> None:
    """Monthly: reset LLM budget period_start for all orgs (1st of month, 00:05 UTC)."""
    try:
        from datetime import datetime, timezone
        new_period = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        await db_pool.execute(
            """
            UPDATE org_llm_budgets
            SET current_period_start = $1, updated_at = NOW()
            WHERE current_period_start < $1
            """,
            new_period,
        )
        logger.info("LLM budget period reset to %s", new_period.isoformat())
    except Exception as exc:
        logger.error("Scheduled period reset failed: %s", exc)


class WorkerSettings:
    functions = [execute_agent_job]
    cron_jobs = [
        # Weekly Sunday 02:00 UTC — prune stale memories
        cron(scheduled_memory_prune, weekday=6, hour=2, minute=0),
        # Monthly 1st 00:05 UTC — reset LLM budget period
        cron(scheduled_period_reset, month={1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12},
             day=1, hour=0, minute=5),
    ]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = get_redis_settings()
    max_jobs = 5
    job_timeout = 600  # 10 min per agent
    retry_jobs = False  # We handle retries ourselves
