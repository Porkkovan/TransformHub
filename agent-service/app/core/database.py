import logging
import os
from typing import Optional

import asyncpg

logger = logging.getLogger(__name__)


class DatabasePool:
    """Async PostgreSQL connection pool backed by asyncpg.

    Pool settings (configurable via environment variables):
        DB_POOL_MIN       - minimum pool size (default: 5)
        DB_POOL_MAX       - maximum pool size (default: 30)
        DB_CONN_TIMEOUT   - seconds to wait for a connection from the pool (default: 30)
        DB_CMD_TIMEOUT    - seconds to wait for a single SQL command (default: 60)
    """

    def __init__(self):
        self._pool: Optional[asyncpg.Pool] = None

    async def connect(self):
        dsn = os.environ.get("DATABASE_URL")
        if not dsn:
            raise RuntimeError("DATABASE_URL environment variable is required")

        min_size = int(os.environ.get("DB_POOL_MIN", "5"))
        max_size = int(os.environ.get("DB_POOL_MAX", "30"))
        conn_timeout = float(os.environ.get("DB_CONN_TIMEOUT", "30"))
        cmd_timeout = float(os.environ.get("DB_CMD_TIMEOUT", "60"))

        logger.info(
            "Creating database pool (min=%d, max=%d, conn_timeout=%.0fs, cmd_timeout=%.0fs)",
            min_size,
            max_size,
            conn_timeout,
            cmd_timeout,
        )

        self._pool = await asyncpg.create_pool(
            dsn=dsn,
            min_size=min_size,
            max_size=max_size,
            timeout=conn_timeout,       # timeout for acquiring a connection from the pool
            command_timeout=cmd_timeout, # timeout for individual SQL commands
        )

    async def disconnect(self):
        if self._pool:
            await self._pool.close()

    @property
    def pool(self) -> asyncpg.Pool:
        if self._pool is None:
            raise RuntimeError("Database pool not initialized. Call connect() first.")
        return self._pool

    async def fetch(self, query: str, *args):
        async with self.pool.acquire() as conn:
            return await conn.fetch(query, *args)

    async def fetchrow(self, query: str, *args):
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(query, *args)

    async def fetchval(self, query: str, *args):
        async with self.pool.acquire() as conn:
            return await conn.fetchval(query, *args)

    async def execute(self, query: str, *args):
        async with self.pool.acquire() as conn:
            return await conn.execute(query, *args)


db_pool = DatabasePool()


class ReadDatabasePool:
    """
    Read-only database pool for replica routing.

    Connects to DATABASE_READ_URL if set; falls back to DATABASE_URL (primary).
    Use for heavy read queries (agent memory, context embeddings, analytics)
    to offload the primary when a read replica is provisioned.
    """

    def __init__(self) -> None:
        self._pool: Optional[asyncpg.Pool] = None

    async def connect(self) -> None:
        read_url = os.environ.get("DATABASE_READ_URL") or os.environ.get("DATABASE_URL")
        if not read_url:
            raise RuntimeError("DATABASE_URL environment variable is required")

        min_size = int(os.environ.get("DB_POOL_MIN", "2"))
        max_size = int(os.environ.get("DB_POOL_MAX", "10"))
        conn_timeout = float(os.environ.get("DB_CONN_TIMEOUT", "30"))
        cmd_timeout = float(os.environ.get("DB_CMD_TIMEOUT", "60"))

        logger.info(
            "Creating read replica pool (min=%d, max=%d, url=%s...)",
            min_size,
            max_size,
            read_url[:30],
        )

        self._pool = await asyncpg.create_pool(
            dsn=read_url,
            min_size=min_size,
            max_size=max_size,
            timeout=conn_timeout,
            command_timeout=cmd_timeout,
        )
        logger.info("Read replica pool connected (url=%s...)", read_url[:30])

    async def disconnect(self) -> None:
        if self._pool:
            await self._pool.close()
            self._pool = None

    async def fetch(self, query: str, *args) -> list:
        if not self._pool:
            raise RuntimeError("Read pool not connected")
        async with self._pool.acquire() as conn:
            return await conn.fetch(query, *args)

    async def fetchrow(self, query: str, *args):
        if not self._pool:
            raise RuntimeError("Read pool not connected")
        async with self._pool.acquire() as conn:
            return await conn.fetchrow(query, *args)

    async def fetchval(self, query: str, *args):
        if not self._pool:
            raise RuntimeError("Read pool not connected")
        async with self._pool.acquire() as conn:
            return await conn.fetchval(query, *args)


read_pool = ReadDatabasePool()
