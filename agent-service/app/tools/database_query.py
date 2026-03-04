"""
Read-only database query tool.

Allows agents to run SELECT queries against the TransformHub database to
gather context (capabilities, products, risk scores, etc.).  Enforces
read-only access by rejecting any query that contains mutation keywords.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from app.core.database import db_pool
from app.tools.base import BaseTool

logger = logging.getLogger(__name__)

# Keywords that indicate a non-SELECT (mutation) query
_MUTATION_KEYWORDS = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|COPY)\b",
    re.IGNORECASE,
)

_MAX_ROWS = 100
_MAX_QUERY_LENGTH = 2000


class DatabaseQueryTool(BaseTool):
    """Execute read-only SQL queries against the TransformHub database."""

    @property
    def name(self) -> str:
        return "database_query"

    @property
    def description(self) -> str:
        return (
            "Execute a read-only SQL SELECT query against the TransformHub "
            "PostgreSQL database. Use this to look up functionalities, digital "
            "capabilities, digital products, risk assessments, compliance "
            "mappings, value stream steps, and other discovery data. "
            "Only SELECT statements are allowed; mutations are rejected."
        )

    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": (
                        "A SQL SELECT query. Example: "
                        "\"SELECT name, description FROM digital_capabilities LIMIT 10\""
                    ),
                },
                "params": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "Optional positional parameters for parameterised queries. "
                        "Use $1, $2, etc. in the query."
                    ),
                    "default": [],
                },
            },
            "required": ["query"],
        }

    async def execute(self, **kwargs: Any) -> Any:
        query: str = kwargs["query"].strip()
        params: list[str] = kwargs.get("params", [])

        # ------------------------------------------------------------------
        # Safety checks
        # ------------------------------------------------------------------

        if len(query) > _MAX_QUERY_LENGTH:
            return {
                "error": f"Query exceeds maximum length of {_MAX_QUERY_LENGTH} characters.",
            }

        if _MUTATION_KEYWORDS.search(query):
            return {
                "error": "Only SELECT queries are allowed. Mutation statements are rejected.",
            }

        # Ensure the query starts with SELECT (or WITH for CTEs)
        normalized = query.lstrip().upper()
        if not (normalized.startswith("SELECT") or normalized.startswith("WITH")):
            return {
                "error": "Query must begin with SELECT (or WITH for CTEs).",
            }

        # Inject a row limit if none is present
        if "LIMIT" not in query.upper():
            query = f"{query} LIMIT {_MAX_ROWS}"

        logger.info("Database query tool: %s (params=%s)", query[:200], params)

        try:
            rows = await db_pool.fetch(query, *params)
            results = [dict(row) for row in rows]

            # Convert non-serialisable types to strings
            for row_dict in results:
                for key, value in row_dict.items():
                    if not isinstance(value, (str, int, float, bool, list, dict, type(None))):
                        row_dict[key] = str(value)

            return {
                "columns": list(results[0].keys()) if results else [],
                "rows": results,
                "row_count": len(results),
                "truncated": len(results) == _MAX_ROWS,
            }

        except Exception as exc:
            logger.error("Database query tool error: %s", exc)
            return {
                "error": f"Query execution failed: {str(exc)}",
            }
