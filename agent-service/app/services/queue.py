import logging
from typing import Any

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from app.core.config import settings

logger = logging.getLogger(__name__)

_arq_pool: ArqRedis | None = None


def get_redis_settings() -> RedisSettings:
    url = settings.redis_url
    # Parse redis://host:port format
    host = "localhost"
    port = 6379
    if "://" in url:
        parts = url.split("://")[1]
        if ":" in parts:
            host, port_str = parts.split(":")
            port = int(port_str.split("/")[0])
        else:
            host = parts.split("/")[0]
    return RedisSettings(host=host, port=port)


async def get_arq_pool() -> ArqRedis:
    global _arq_pool
    if _arq_pool is None:
        _arq_pool = await create_pool(get_redis_settings())
    return _arq_pool


async def enqueue_agent(
    execution_id: str,
    agent_type: str,
    input_data: dict[str, Any],
) -> None:
    pool = await get_arq_pool()
    await pool.enqueue_job(
        "execute_agent_job",
        execution_id,
        agent_type,
        input_data,
        _job_id=execution_id,
    )
    logger.info("Enqueued agent job: %s (%s)", agent_type, execution_id)
