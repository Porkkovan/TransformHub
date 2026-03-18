"""
Unified LLM interface that routes requests to Claude (default), OpenAI, or
Google Gemini based on model preference.

Usage:
    from app.services.llm_router import llm_router

    response = await llm_router.analyze("Explain microservices", model_preference="claude-sonnet-4-5")
"""

from __future__ import annotations

import json
import logging
import os
import time
from collections import defaultdict
from contextvars import ContextVar
from typing import Any, Optional

from app.services.circuit_breaker import CircuitBreakerOpen, get_breaker
from app.services.llm_config import (
    DEFAULT_MODEL,
    MODEL_CONFIGS,
    get_model_config,
)

# Per-request org API key override.
# Set this context variable before calling llm_router to use an org-specific
# Anthropic key instead of the global ANTHROPIC_API_KEY env var.
_org_anthropic_key: ContextVar[Optional[str]] = ContextVar(
    "_org_anthropic_key", default=None
)

# ---------------------------------------------------------------------------
# Token counting
# ---------------------------------------------------------------------------

_tiktoken_encoder = None
_tiktoken_available = False

try:
    import tiktoken

    _tiktoken_encoder = tiktoken.get_encoding("cl100k_base")
    _tiktoken_available = True
except Exception:
    pass  # Fall back to heuristic if tiktoken is not available


def _count_tokens(text: str) -> int:
    """Count tokens using tiktoken if available, otherwise fall back to a heuristic."""
    if _tiktoken_available and _tiktoken_encoder is not None:
        return len(_tiktoken_encoder.encode(text))
    # Fallback heuristic: ~1 token per 4 characters
    return len(text) // 4

logger = logging.getLogger(__name__)


class LLMRouter:
    """Routes LLM calls to the appropriate provider and tracks usage."""

    def __init__(self) -> None:
        self._usage: dict[str, dict[str, Any]] = defaultdict(
            lambda: {"requests": 0, "input_tokens": 0, "output_tokens": 0, "cost": 0.0}
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def analyze(
        self,
        prompt: str,
        system: str = "You are an expert enterprise transformation analyst.",
        max_tokens: int = 4096,
        model_preference: Optional[str] = None,
    ) -> str:
        """Route an analysis request to the preferred (or default) model.

        Falls back to OpenAI when the preferred provider fails and
        ``OPENAI_API_KEY`` is configured.
        """
        model_name = model_preference or DEFAULT_MODEL
        try:
            return await self._dispatch(model_name, prompt, system, max_tokens)
        except Exception as primary_err:
            logger.warning(
                "Primary model %s failed: %s – attempting fallback",
                model_name,
                primary_err,
            )
            return await self._fallback(prompt, system, max_tokens, exclude=model_name)

    async def analyze_structured(
        self,
        prompt: str,
        system: str = "You are an expert enterprise transformation analyst. Always respond with valid JSON.",
        max_tokens: int = 4096,
        model_preference: Optional[str] = None,
    ) -> str:
        """Same as ``analyze`` but strips markdown fences so callers get raw JSON."""
        model_name = model_preference or DEFAULT_MODEL
        try:
            raw = await self._dispatch(model_name, prompt, system, max_tokens)
        except Exception as primary_err:
            logger.warning(
                "Primary structured model %s failed: %s – attempting fallback",
                model_name,
                primary_err,
            )
            raw = await self._fallback(prompt, system, max_tokens, exclude=model_name)
        return self._strip_json_fences(raw)

    @staticmethod
    def _strip_json_fences(text: str) -> str:
        """Remove markdown code fences that LLMs wrap around JSON responses.

        Handles:
          ```json\\n{...}\\n```
          ```\\n{...}\\n```
          Leading/trailing whitespace
        """
        import re
        text = text.strip()
        # Remove ```json ... ``` or ``` ... ``` wrappers
        text = re.sub(r"^```(?:json)?\s*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)
        return text.strip()

    def get_usage(self) -> dict[str, dict[str, Any]]:
        """Return accumulated usage stats keyed by model name."""
        return dict(self._usage)

    def reset_usage(self) -> None:
        """Clear all accumulated usage stats."""
        self._usage.clear()

    # ------------------------------------------------------------------
    # Internal dispatch
    # ------------------------------------------------------------------

    async def _dispatch(
        self,
        model_name: str,
        prompt: str,
        system: str,
        max_tokens: int,
    ) -> str:
        """Send the request to the correct provider, guarded by circuit breaker."""
        config = get_model_config(model_name)
        provider = config["provider"]
        breaker = get_breaker(provider)

        start = time.monotonic()

        async def _call():
            if provider == "anthropic":
                return await self._call_anthropic(config, prompt, system, max_tokens)
            elif provider == "azure_openai":
                return await self._call_azure_openai(config, prompt, system, max_tokens)
            elif provider == "openai":
                return await self._call_openai(config, prompt, system, max_tokens)
            elif provider == "google":
                return await self._call_google(config, prompt, system, max_tokens)
            else:
                raise ValueError(f"Unknown provider: {provider}")

        result = await breaker.call(_call)

        elapsed = time.monotonic() - start
        self._track(model_name, prompt, result, config)
        logger.info(
            "LLM call model=%s provider=%s latency=%.2fs",
            model_name,
            provider,
            elapsed,
        )

        return result

    async def _fallback(
        self,
        prompt: str,
        system: str,
        max_tokens: int,
        exclude: str,
    ) -> str:
        """Try Azure OpenAI first, then standard OpenAI, then Claude as final fallback.
        Skips providers whose circuit breaker is OPEN."""
        from app.services.circuit_breaker import CircuitState, get_breaker

        candidates = [
            ("gpt-4o-azure",       "AZURE_OPENAI_API_KEY", "azure_openai"),
            ("gpt-4o",             "OPENAI_API_KEY",        "openai"),
            ("claude-sonnet-4-5",  "ANTHROPIC_API_KEY",     "anthropic"),
        ]
        for model_name, env_key, provider in candidates:
            if model_name == exclude:
                continue
            if not os.environ.get(env_key):
                continue
            breaker = get_breaker(provider)
            if breaker.state == CircuitState.OPEN:
                logger.warning("Skipping fallback to %s — circuit OPEN", model_name)
                continue
            logger.info("Falling back to %s", model_name)
            return await self._dispatch(model_name, prompt, system, max_tokens)

        raise RuntimeError("All LLM providers failed and no fallback is available")

    # ------------------------------------------------------------------
    # Provider implementations
    # ------------------------------------------------------------------

    async def _call_anthropic(
        self,
        config: dict[str, Any],
        prompt: str,
        system: str,
        max_tokens: int,
    ) -> str:
        """Call the Anthropic Messages API directly.

        Uses the per-request org API key (set via _org_anthropic_key context var)
        when available, falling back to the global ANTHROPIC_API_KEY env var.
        This avoids the circular delegation through ClaudeClient.
        """
        import anthropic

        api_key = _org_anthropic_key.get() or os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")

        client = anthropic.AsyncAnthropic(api_key=api_key)
        message = await client.messages.create(
            model=config["model_id"],
            max_tokens=min(max_tokens, config["max_tokens"]),
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text

    async def _call_azure_openai(
        self,
        config: dict[str, Any],
        prompt: str,
        system: str,
        max_tokens: int,
    ) -> str:
        """Call Azure OpenAI chat completions API via httpx."""
        import httpx

        api_key = os.environ.get("AZURE_OPENAI_API_KEY")
        endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT", "").rstrip("/")
        deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT", config["model_id"])
        api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")

        if not api_key or not endpoint:
            raise RuntimeError("AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT must be set")

        url = f"{endpoint}/openai/deployments/{deployment}/chat/completions?api-version={api_version}"

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                url,
                headers={
                    "api-key": api_key,
                    "Content-Type": "application/json",
                },
                json={
                    "max_tokens": min(max_tokens, config["max_tokens"]),
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    async def _call_openai(
        self,
        config: dict[str, Any],
        prompt: str,
        system: str,
        max_tokens: int,
    ) -> str:
        """Call OpenAI chat completions API via httpx."""
        import httpx

        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": config["model_id"],
                    "max_tokens": min(max_tokens, config["max_tokens"]),
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    async def _call_google(
        self,
        config: dict[str, Any],
        prompt: str,
        system: str,
        max_tokens: int,
    ) -> str:
        """Call Google Gemini API via httpx."""
        import httpx

        api_key = os.environ.get("GOOGLE_AI_API_KEY")
        if not api_key:
            raise RuntimeError("GOOGLE_AI_API_KEY is not set")

        model_id = config["model_id"]
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={api_key}"

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                url,
                headers={"Content-Type": "application/json"},
                json={
                    "systemInstruction": {"parts": [{"text": system}]},
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "maxOutputTokens": min(max_tokens, config["max_tokens"]),
                    },
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]

    # ------------------------------------------------------------------
    # Usage tracking
    # ------------------------------------------------------------------

    def _track(
        self,
        model_name: str,
        prompt: str,
        result: str,
        config: dict[str, Any],
    ) -> None:
        """Estimate token usage and accumulate stats."""
        input_tokens = _count_tokens(prompt)
        output_tokens = _count_tokens(result)

        entry = self._usage[model_name]
        entry["requests"] += 1
        entry["input_tokens"] += input_tokens
        entry["output_tokens"] += output_tokens
        entry["cost"] += (
            (input_tokens / 1000) * config["cost_per_1k_input"]
            + (output_tokens / 1000) * config["cost_per_1k_output"]
        )


# Module-level singleton
llm_router = LLMRouter()


def set_org_anthropic_key(api_key: Optional[str]) -> None:
    """Set a per-request Anthropic API key for the current async context.

    Call this before invoking llm_router.analyze() to use an org-specific key.
    The context variable is scoped to the current asyncio Task, so it won't
    bleed into other concurrent requests.

    Example::

        set_org_anthropic_key(org.anthropic_api_key)
        try:
            result = await llm_router.analyze(prompt)
        finally:
            set_org_anthropic_key(None)
    """
    _org_anthropic_key.set(api_key)
