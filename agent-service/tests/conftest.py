import asyncio
import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# Set test environment variables before importing app modules
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/testdb")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_db_pool():
    """Mock the database pool for tests that don't need a real DB."""
    with patch("app.core.database.db_pool") as mock:
        mock.fetch = AsyncMock(return_value=[])
        mock.fetchrow = AsyncMock(return_value=None)
        mock.fetchval = AsyncMock(return_value=None)
        mock.execute = AsyncMock(return_value="INSERT 1")
        mock.connect = AsyncMock()
        mock.disconnect = AsyncMock()
        yield mock


@pytest.fixture
def mock_redis_pool():
    """Mock the Redis pool for tests that don't need a real Redis."""
    with patch("app.core.redis.redis_pool") as mock:
        mock_client = MagicMock()
        mock_client.get = AsyncMock(return_value=None)
        mock_client.set = AsyncMock()
        mock_client.delete = AsyncMock()
        mock_client.ping = AsyncMock()
        mock_client.hset = AsyncMock()
        mock_client.hget = AsyncMock(return_value=None)
        mock_client.hgetall = AsyncMock(return_value={})
        mock.client = mock_client
        mock.connect = AsyncMock()
        mock.disconnect = AsyncMock()
        yield mock


@pytest.fixture
def mock_claude_client():
    """Mock the Claude client for tests that don't need real API calls."""
    with patch("app.services.claude_client.claude_client") as mock:
        mock.analyze = AsyncMock(return_value="Test analysis result")
        mock.analyze_structured = AsyncMock(return_value='{"test": "result"}')
        yield mock


@pytest.fixture
def mock_event_bus():
    """Mock the event bus for tests that don't need real pub/sub."""
    with patch("app.services.event_bus.event_bus") as mock:
        mock.publish = AsyncMock()
        mock.subscribe = AsyncMock()
        mock.close_channel = AsyncMock()
        yield mock


@pytest.fixture
def sample_input_data():
    return {
        "organization_name": "Test Corp",
        "industry": "technology",
        "repository_url": "https://github.com/test/repo",
    }
