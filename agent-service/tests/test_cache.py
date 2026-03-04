"""Tests for CacheService with mocked Redis."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.cache import CacheService


@pytest.fixture
def mock_redis_client():
    client = AsyncMock()
    client.get = AsyncMock(return_value=None)
    client.set = AsyncMock()
    client.delete = AsyncMock()
    client.scan = AsyncMock(return_value=(0, []))
    return client


@pytest.fixture
def cache(mock_redis_client):
    with patch("app.services.cache.redis_pool") as mock_pool:
        mock_pool.client = mock_redis_client
        svc = CacheService(prefix="test")
        yield svc, mock_redis_client


@pytest.mark.asyncio
async def test_get_json_returns_none_on_miss(cache):
    svc, mock_client = cache
    mock_client.get.return_value = None
    result = await svc.get_json("missing_key")
    assert result is None
    mock_client.get.assert_called_once_with("test:missing_key")


@pytest.mark.asyncio
async def test_get_json_returns_parsed_value(cache):
    svc, mock_client = cache
    data = {"hello": "world", "count": 42}
    mock_client.get.return_value = json.dumps(data)
    result = await svc.get_json("my_key")
    assert result == data


@pytest.mark.asyncio
async def test_set_json_serializes_and_stores(cache):
    svc, mock_client = cache
    data = {"key": "value"}
    await svc.set_json("my_key", data, ttl=120)
    mock_client.set.assert_called_once_with("test:my_key", json.dumps(data, default=str), ex=120)


@pytest.mark.asyncio
async def test_invalidate_deletes_key(cache):
    svc, mock_client = cache
    await svc.invalidate("old_key")
    mock_client.delete.assert_called_once_with("test:old_key")


@pytest.mark.asyncio
async def test_invalidate_pattern_scans_and_deletes(cache):
    svc, mock_client = cache
    mock_client.scan.return_value = (0, [b"test:org:1:a", b"test:org:1:b"])
    await svc.invalidate_pattern("org:1:*")
    mock_client.scan.assert_called()
    mock_client.delete.assert_called_once_with(b"test:org:1:a", b"test:org:1:b")
