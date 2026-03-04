"""
Web search tool (mock-ready implementation using httpx).

In production, swap the mock with a real search API (Brave, Tavily, SerpAPI,
etc.) by updating ``_SEARCH_API_URL`` and the response parser.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.tools.base import BaseTool

logger = logging.getLogger(__name__)

# Replace with a real search API endpoint in production
_SEARCH_API_URL = "https://api.search.example.com/v1/search"
_SEARCH_API_KEY = ""  # Set via env or config in production
_TIMEOUT_SECONDS = 15


class WebSearchTool(BaseTool):
    """Search the web and return a list of results with titles, URLs, and snippets."""

    @property
    def name(self) -> str:
        return "web_search"

    @property
    def description(self) -> str:
        return (
            "Search the web for current information. Returns a list of search "
            "results with titles, URLs, and text snippets. Useful for finding "
            "recent news, documentation, market data, regulatory updates, or "
            "competitive intelligence."
        )

    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query string.",
                },
                "num_results": {
                    "type": "integer",
                    "description": "Maximum number of results to return (default 5).",
                    "default": 5,
                },
            },
            "required": ["query"],
        }

    async def execute(self, **kwargs: Any) -> Any:
        query: str = kwargs["query"]
        num_results: int = kwargs.get("num_results", 5)

        logger.info("Web search: query=%r num_results=%d", query, num_results)

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
                response = await client.get(
                    _SEARCH_API_URL,
                    params={
                        "q": query,
                        "count": num_results,
                    },
                    headers={
                        "X-Api-Key": _SEARCH_API_KEY,
                        "Accept": "application/json",
                    },
                )
                response.raise_for_status()
                data = response.json()

                # Normalize response to a consistent format
                results = []
                for item in data.get("results", data.get("web", {}).get("results", []))[:num_results]:
                    results.append({
                        "title": item.get("title", ""),
                        "url": item.get("url", item.get("link", "")),
                        "snippet": item.get("snippet", item.get("description", "")),
                    })

                return {
                    "query": query,
                    "results": results,
                    "total_results": len(results),
                }

        except httpx.HTTPStatusError as exc:
            logger.warning("Search API HTTP error: %s", exc)
            return await self._mock_search(query, num_results)
        except (httpx.RequestError, Exception) as exc:
            logger.warning("Search API unavailable, using mock: %s", exc)
            return await self._mock_search(query, num_results)

    async def _mock_search(self, query: str, num_results: int) -> dict[str, Any]:
        """Fallback mock search results for development / offline use."""
        mock_results = [
            {
                "title": f"Result {i + 1} for: {query}",
                "url": f"https://example.com/search?q={query.replace(' ', '+')}&p={i + 1}",
                "snippet": (
                    f"This is a mock search result #{i + 1} for the query '{query}'. "
                    f"In production, this would contain real web content."
                ),
            }
            for i in range(min(num_results, 5))
        ]
        return {
            "query": query,
            "results": mock_results,
            "total_results": len(mock_results),
            "_mock": True,
        }
