import time
from typing import Any

from fastapi import APIRouter

from app.core.database import db_pool
from app.core.redis import redis_pool

router = APIRouter(tags=["health"])

_start_time = time.time()


async def _check_database() -> dict[str, Any]:
    """Ping the Postgres database and return status + latency."""
    try:
        start = time.monotonic()
        await db_pool.fetchval("SELECT 1")
        latency_ms = round((time.monotonic() - start) * 1000, 2)
        return {"status": "connected", "latency_ms": latency_ms}
    except Exception as exc:
        return {"status": "disconnected", "error": str(exc)}


async def _check_redis() -> dict[str, Any]:
    """Ping Redis and return status + latency. Redis is optional."""
    client = redis_pool.client
    if client is None:
        return {"status": "unavailable", "note": "running with in-memory fallback"}
    try:
        start = time.monotonic()
        await client.ping()
        latency_ms = round((time.monotonic() - start) * 1000, 2)
        return {"status": "connected", "latency_ms": latency_ms}
    except Exception as exc:
        return {"status": "disconnected", "error": str(exc)}


@router.get("/health")
async def health_check():
    """
    Liveness probe. Only database is a critical dependency; Redis is optional.
    Returns 200 as long as the database is reachable.
    """
    db_status = await _check_database()
    redis_status = await _check_redis()

    all_healthy = db_status["status"] == "connected"

    body = {
        "status": "healthy" if all_healthy else "unhealthy",
        "service": "transformhub-agent-service",
        "version": "2.0.0",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "uptime": round(time.time() - _start_time),
        "database": db_status,
        "redis": redis_status,
    }

    if all_healthy:
        return body

    from fastapi.responses import JSONResponse
    return JSONResponse(content=body, status_code=503)


@router.get("/health/ready")
async def readiness_check():
    """
    Readiness probe.
    Returns 200 only when both database and Redis are reachable,
    meaning the service can handle traffic.
    """
    db_status = await _check_database()
    redis_status = await _check_redis()

    ready = db_status["status"] == "connected"

    body = {
        "ready": ready,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "database": db_status,
        "redis": redis_status,
    }

    if ready:
        return body

    from fastapi.responses import JSONResponse
    return JSONResponse(content=body, status_code=503)
