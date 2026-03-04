"""Tests for tool base class, registry functions, and safety checks."""

import pytest
from unittest.mock import AsyncMock
from typing import Any

from app.tools.base import BaseTool
from app.tools import registry as tool_registry
from app.tools.database_query import _MUTATION_KEYWORDS


class DummyTool(BaseTool):
    @property
    def name(self) -> str:
        return "dummy"

    @property
    def description(self) -> str:
        return "A dummy tool for testing"

    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {"value": {"type": "string"}},
            "required": ["value"],
        }

    async def execute(self, **kwargs: Any) -> str:
        return f"got: {kwargs['value']}"


def test_tool_to_anthropic_format():
    tool = DummyTool()
    fmt = tool.to_anthropic_tool()
    assert fmt["name"] == "dummy"
    assert fmt["description"] == "A dummy tool for testing"
    assert "properties" in fmt["input_schema"]


@pytest.mark.asyncio
async def test_dummy_tool_execute():
    tool = DummyTool()
    result = await tool.execute(value="hello")
    assert result == "got: hello"


def test_registry_register_and_get():
    tool_registry.register_tool(DummyTool())
    result = tool_registry.get_tool("dummy")
    assert result is not None
    assert result.name == "dummy"
    # Cleanup
    tool_registry._ALL_TOOLS.pop("dummy", None)


def test_get_tools_for_agent_with_allowlist():
    tools = tool_registry.get_tools_for_agent("discovery")
    tool_names = {t.name for t in tools}
    assert "database_query" in tool_names
    assert "file_reader" in tool_names


def test_get_tools_for_unknown_agent_returns_empty():
    tools = tool_registry.get_tools_for_agent("nonexistent_agent_xyz")
    assert tools == []


def test_get_anthropic_tools_format():
    tools = tool_registry.get_anthropic_tools_for_agent("discovery")
    assert len(tools) > 0
    for t in tools:
        assert "name" in t
        assert "description" in t
        assert "input_schema" in t


def test_mutation_keywords_rejects_write_statements():
    dangerous = [
        "DROP TABLE users",
        "DELETE FROM orders",
        "INSERT INTO logs VALUES (1)",
        "UPDATE users SET role='admin'",
        "TRUNCATE TABLE sessions",
    ]
    for stmt in dangerous:
        assert _MUTATION_KEYWORDS.search(stmt) is not None, f"Should reject: {stmt}"


def test_mutation_keywords_allows_select():
    safe = [
        "SELECT * FROM users",
        "SELECT count(*) FROM orders WHERE status='active'",
    ]
    for stmt in safe:
        assert _MUTATION_KEYWORDS.search(stmt) is None, f"Should allow: {stmt}"
