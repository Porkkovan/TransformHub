"""
Circuit breaker for LLM provider calls.

States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing recovery)

Usage:
    breaker = CircuitBreaker("anthropic", failure_threshold=5, recovery_timeout=60)
    async with breaker:
        result = await llm_call()
"""

from __future__ import annotations

import asyncio
import logging
import time
from enum import Enum
from typing import Callable, Optional

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreakerOpen(Exception):
    """Raised when a call is attempted on an open circuit."""

    def __init__(self, provider: str, retry_after: float) -> None:
        self.provider = provider
        self.retry_after = retry_after
        super().__init__(
            f"Circuit breaker OPEN for provider '{provider}'. "
            f"Retry after {retry_after:.0f}s."
        )


class CircuitBreaker:
    """Per-provider circuit breaker with sliding-window failure counting."""

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        half_open_max_calls: int = 2,
        on_state_change: Optional[Callable[[str, CircuitState, CircuitState], None]] = None,
    ) -> None:
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls
        self.on_state_change = on_state_change

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_failure_time: float = 0.0
        self._half_open_calls = 0
        self._lock = asyncio.Lock()

    @property
    def state(self) -> CircuitState:
        return self._state

    async def call(self, coro_func, *args, **kwargs):
        """Execute *coro_func* through the circuit breaker."""
        async with self._lock:
            await self._maybe_transition()
            if self._state == CircuitState.OPEN:
                retry_after = (
                    self._last_failure_time + self.recovery_timeout - time.monotonic()
                )
                raise CircuitBreakerOpen(self.name, max(retry_after, 0))
            if self._state == CircuitState.HALF_OPEN:
                self._half_open_calls += 1

        try:
            result = await coro_func(*args, **kwargs)
            await self._on_success()
            return result
        except Exception as exc:
            await self._on_failure()
            raise

    async def _maybe_transition(self) -> None:
        if (
            self._state == CircuitState.OPEN
            and time.monotonic() - self._last_failure_time >= self.recovery_timeout
        ):
            self._transition(CircuitState.HALF_OPEN)
            self._half_open_calls = 0

    async def _on_success(self) -> None:
        async with self._lock:
            if self._state in (CircuitState.HALF_OPEN, CircuitState.CLOSED):
                prev = self._state
                self._failure_count = 0
                self._transition(CircuitState.CLOSED)

    async def _on_failure(self) -> None:
        async with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.monotonic()
            if (
                self._state == CircuitState.HALF_OPEN
                or self._failure_count >= self.failure_threshold
            ):
                self._transition(CircuitState.OPEN)

    def _transition(self, new_state: CircuitState) -> None:
        if new_state == self._state:
            return
        old_state = self._state
        self._state = new_state
        logger.warning(
            "Circuit breaker '%s': %s → %s (failures=%d)",
            self.name,
            old_state.value,
            new_state.value,
            self._failure_count,
        )
        if self.on_state_change:
            try:
                self.on_state_change(self.name, old_state, new_state)
            except Exception:
                pass

    def get_stats(self) -> dict:
        return {
            "name": self.name,
            "state": self._state.value,
            "failure_count": self._failure_count,
            "last_failure_age_s": (
                round(time.monotonic() - self._last_failure_time, 1)
                if self._last_failure_time
                else None
            ),
        }


# One breaker per LLM provider
_breakers: dict[str, CircuitBreaker] = {}


def get_breaker(provider: str) -> CircuitBreaker:
    if provider not in _breakers:
        _breakers[provider] = CircuitBreaker(
            name=provider,
            failure_threshold=5,
            recovery_timeout=60.0,
        )
    return _breakers[provider]


def get_all_stats() -> list[dict]:
    return [b.get_stats() for b in _breakers.values()]
