"""
BaseTool abstract base class for all agent tools.

Every tool exposes a name, description, and JSON-schema-compatible input
definition that maps directly to the Anthropic ``tool_use`` API format.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class BaseTool(ABC):
    """Abstract base class for agent-callable tools.

    Subclasses must implement:
      - ``name`` — unique identifier used in the tool registry
      - ``description`` — human-readable description sent to Claude
      - ``input_schema`` — JSON Schema dict describing expected parameters
      - ``execute(**kwargs)`` — async method that performs the tool action
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique tool identifier (e.g. ``"web_search"``)."""
        ...

    @property
    @abstractmethod
    def description(self) -> str:
        """One-paragraph description of what this tool does."""
        ...

    @property
    @abstractmethod
    def input_schema(self) -> dict[str, Any]:
        """JSON Schema for the tool's input parameters.

        Example::

            {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query."
                    }
                },
                "required": ["query"]
            }
        """
        ...

    @abstractmethod
    async def execute(self, **kwargs: Any) -> Any:
        """Run the tool with the given keyword arguments.

        Returns a JSON-serialisable result (string, dict, list, etc.).
        """
        ...

    # ------------------------------------------------------------------
    # Anthropic tool_use format
    # ------------------------------------------------------------------

    def to_anthropic_tool(self) -> dict[str, Any]:
        """Serialise to the format expected by ``anthropic.messages.create(tools=[...])``.

        Returns a dict with ``name``, ``description``, and ``input_schema``.
        """
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema,
        }

    def __repr__(self) -> str:
        return f"<Tool name={self.name!r}>"
