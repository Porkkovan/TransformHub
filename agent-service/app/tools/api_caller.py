"""
HTTP API caller tool with domain allowlisting.

Allows agents to make outbound HTTP requests to pre-approved external APIs
(e.g. regulatory databases, market data providers).  All requests are
validated against the domain allowlist before execution.
"""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlparse

import httpx

from app.tools.base import BaseTool

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Domain allowlist — extend as needed for production integrations
# ---------------------------------------------------------------------------

ALLOWED_DOMAINS: set[str] = {
    "api.sec.gov",
    "efts.sec.gov",
    "data.sec.gov",
    "api.finra.org",
    "registry.npmjs.org",
    "pypi.org",
    "api.github.com",
    "api.openai.com",
    "api.anthropic.com",
    "jsonplaceholder.typicode.com",  # testing / mock
    "httpbin.org",                   # testing / mock
}

_TIMEOUT_SECONDS = 30
_MAX_RESPONSE_SIZE = 256 * 1024  # 256 KB
_ALLOWED_METHODS = {"GET", "POST", "PUT", "PATCH"}


class ApiCallerTool(BaseTool):
    """Make HTTP requests to allowlisted external APIs."""

    @property
    def name(self) -> str:
        return "api_caller"

    @property
    def description(self) -> str:
        return (
            "Make HTTP requests to pre-approved external APIs. Supports GET, "
            "POST, PUT, and PATCH methods. The target domain must be in the "
            "allowlist. Useful for fetching regulatory filings, market data, "
            "package registry information, or other external data sources."
        )

    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The full URL to request (must be on an allowlisted domain).",
                },
                "method": {
                    "type": "string",
                    "enum": ["GET", "POST", "PUT", "PATCH"],
                    "description": "HTTP method (default: GET).",
                    "default": "GET",
                },
                "headers": {
                    "type": "object",
                    "additionalProperties": {"type": "string"},
                    "description": "Optional HTTP headers as key-value pairs.",
                    "default": {},
                },
                "body": {
                    "type": "object",
                    "description": "Optional JSON request body (for POST/PUT/PATCH).",
                },
                "params": {
                    "type": "object",
                    "additionalProperties": {"type": "string"},
                    "description": "Optional URL query parameters.",
                    "default": {},
                },
            },
            "required": ["url"],
        }

    async def execute(self, **kwargs: Any) -> Any:
        url: str = kwargs["url"]
        method: str = kwargs.get("method", "GET").upper()
        headers: dict[str, str] = kwargs.get("headers", {})
        body: dict | None = kwargs.get("body")
        params: dict[str, str] = kwargs.get("params", {})

        # ------------------------------------------------------------------
        # Validate domain against allowlist
        # ------------------------------------------------------------------
        parsed = urlparse(url)
        domain = parsed.hostname or ""

        if domain not in ALLOWED_DOMAINS:
            return {
                "error": (
                    f"Domain '{domain}' is not in the allowlist. "
                    f"Allowed domains: {', '.join(sorted(ALLOWED_DOMAINS))}"
                ),
            }

        if method not in _ALLOWED_METHODS:
            return {"error": f"HTTP method '{method}' is not allowed."}

        # Force HTTPS
        if parsed.scheme == "http":
            url = url.replace("http://", "https://", 1)

        logger.info("API call: %s %s (domain=%s)", method, url[:200], domain)

        # ------------------------------------------------------------------
        # Execute request
        # ------------------------------------------------------------------
        try:
            async with httpx.AsyncClient(
                timeout=_TIMEOUT_SECONDS,
                follow_redirects=True,
                max_redirects=5,
            ) as client:
                request_kwargs: dict[str, Any] = {
                    "method": method,
                    "url": url,
                    "headers": {
                        "User-Agent": "TransformHub-Agent/1.0",
                        "Accept": "application/json",
                        **headers,
                    },
                    "params": params or None,
                }

                if body and method in ("POST", "PUT", "PATCH"):
                    request_kwargs["json"] = body

                response = await client.request(**request_kwargs)

                # Truncate response body if too large
                raw_body = response.content[:_MAX_RESPONSE_SIZE]
                content_type = response.headers.get("content-type", "")

                if "application/json" in content_type:
                    try:
                        response_data = response.json()
                    except Exception:
                        response_data = raw_body.decode("utf-8", errors="replace")
                else:
                    response_data = raw_body.decode("utf-8", errors="replace")

                return {
                    "status_code": response.status_code,
                    "content_type": content_type,
                    "data": response_data,
                    "headers": dict(response.headers),
                    "url": str(response.url),
                    "truncated": len(response.content) > _MAX_RESPONSE_SIZE,
                }

        except httpx.TimeoutException:
            return {"error": f"Request timed out after {_TIMEOUT_SECONDS}s."}
        except httpx.RequestError as exc:
            logger.error("API caller request error: %s", exc)
            return {"error": f"Request failed: {str(exc)}"}
        except Exception as exc:
            logger.error("API caller unexpected error: %s", exc)
            return {"error": f"Unexpected error: {str(exc)}"}
