"""
Tool registry with per-agent allowlists.

Central registry that maps agent types to the set of tools they are permitted
to use.  The ``get_tools_for_agent`` function returns instantiated tool objects
ready for the Anthropic tool_use API.
"""

from __future__ import annotations

import logging
from typing import Any

from app.tools.base import BaseTool
from app.tools.web_search import WebSearchTool
from app.tools.database_query import DatabaseQueryTool
from app.tools.file_reader import FileReaderTool
from app.tools.api_caller import ApiCallerTool

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Global tool instances (singletons)
# ---------------------------------------------------------------------------

_ALL_TOOLS: dict[str, BaseTool] = {
    "web_search": WebSearchTool(),
    "database_query": DatabaseQueryTool(),
    "file_reader": FileReaderTool(),
    "api_caller": ApiCallerTool(),
}


# ---------------------------------------------------------------------------
# Per-agent allowlists
# ---------------------------------------------------------------------------

# Each agent type maps to a set of tool names it is allowed to use.
# An empty set means no tool access.  Use ``"*"`` to allow all tools.

AGENT_TOOL_ALLOWLIST: dict[str, set[str]] = {
    # Git Integration needs file access
    "git_integration": {"file_reader", "database_query"},

    # Discovery needs DB access to read existing entities
    "discovery": {"database_query", "file_reader"},

    # Analysis agents — broad access
    "lean_vsm": {"database_query", "web_search"},
    "risk_compliance": {"database_query", "web_search", "api_caller"},
    "architecture": {"database_query", "file_reader", "web_search"},
    "market_intelligence": {"web_search", "api_caller", "database_query"},
    "data_governance": {"database_query", "web_search", "api_caller"},

    # Synthesis agents
    "fiduciary": {"database_query", "web_search", "api_caller"},
    "product_transformation": {"database_query", "web_search"},

    # Planning / Vision agents
    "backlog_okr": {"database_query"},
    "future_state_vision": {"database_query", "web_search"},
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_tool(name: str) -> BaseTool | None:
    """Look up a tool by name. Returns ``None`` if not registered."""
    return _ALL_TOOLS.get(name)


def get_tools_for_agent(agent_type: str) -> list[BaseTool]:
    """Return the list of tool instances allowed for the given agent type.

    If ``agent_type`` is not in the allowlist, returns an empty list.
    """
    allowed_names = AGENT_TOOL_ALLOWLIST.get(agent_type, set())

    if "*" in allowed_names:
        tools = list(_ALL_TOOLS.values())
    else:
        tools = [
            _ALL_TOOLS[name]
            for name in allowed_names
            if name in _ALL_TOOLS
        ]

    logger.debug(
        "Resolved %d tools for agent '%s': %s",
        len(tools),
        agent_type,
        [t.name for t in tools],
    )
    return tools


def get_anthropic_tools_for_agent(agent_type: str) -> list[dict[str, Any]]:
    """Return Anthropic ``tool_use``-formatted tool definitions for an agent.

    This is the value you pass as ``tools=[...]`` to ``anthropic.messages.create``.
    """
    return [tool.to_anthropic_tool() for tool in get_tools_for_agent(agent_type)]


def register_tool(tool: BaseTool) -> None:
    """Register a custom tool at runtime."""
    if tool.name in _ALL_TOOLS:
        logger.warning("Overwriting existing tool: %s", tool.name)
    _ALL_TOOLS[tool.name] = tool
    logger.info("Registered tool: %s", tool.name)


def grant_tool_access(agent_type: str, tool_name: str) -> None:
    """Grant an agent type access to a specific tool at runtime."""
    if agent_type not in AGENT_TOOL_ALLOWLIST:
        AGENT_TOOL_ALLOWLIST[agent_type] = set()
    AGENT_TOOL_ALLOWLIST[agent_type].add(tool_name)


def revoke_tool_access(agent_type: str, tool_name: str) -> None:
    """Revoke an agent type's access to a specific tool."""
    if agent_type in AGENT_TOOL_ALLOWLIST:
        AGENT_TOOL_ALLOWLIST[agent_type].discard(tool_name)


def list_all_tools() -> list[dict[str, str]]:
    """Return metadata for all registered tools."""
    return [
        {"name": t.name, "description": t.description}
        for t in _ALL_TOOLS.values()
    ]
