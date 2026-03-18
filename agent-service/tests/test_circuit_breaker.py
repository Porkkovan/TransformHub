"""Unit tests for the circuit breaker service."""
import asyncio
import pytest
from app.services.circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerOpen,
    CircuitState,
    get_breaker,
)


@pytest.mark.asyncio
async def test_closed_state_passes_calls():
    breaker = CircuitBreaker("test_closed", failure_threshold=3)
    async def ok():
        return "ok"
    result = await breaker.call(ok)
    assert result == "ok"
    assert breaker.state == CircuitState.CLOSED


@pytest.mark.asyncio
async def test_transitions_to_open_after_threshold():
    breaker = CircuitBreaker("test_open", failure_threshold=3)

    async def fail():
        raise RuntimeError("boom")

    for _ in range(3):
        with pytest.raises(RuntimeError):
            await breaker.call(fail)

    assert breaker.state == CircuitState.OPEN


@pytest.mark.asyncio
async def test_open_raises_circuit_breaker_open():
    breaker = CircuitBreaker("test_open_raise", failure_threshold=2, recovery_timeout=60)

    async def fail():
        raise RuntimeError("fail")

    for _ in range(2):
        with pytest.raises(RuntimeError):
            await breaker.call(fail)

    assert breaker.state == CircuitState.OPEN
    with pytest.raises(CircuitBreakerOpen) as exc_info:
        await breaker.call(fail)
    assert "OPEN" in str(exc_info.value)


@pytest.mark.asyncio
async def test_half_open_after_recovery_timeout():
    breaker = CircuitBreaker("test_half_open", failure_threshold=2, recovery_timeout=0.05)

    async def fail():
        raise RuntimeError("fail")

    for _ in range(2):
        with pytest.raises(RuntimeError):
            await breaker.call(fail)

    assert breaker.state == CircuitState.OPEN
    await asyncio.sleep(0.1)

    async def succeed():
        return "recovered"

    result = await breaker.call(succeed)
    assert result == "recovered"
    assert breaker.state == CircuitState.CLOSED


@pytest.mark.asyncio
async def test_success_resets_failure_count():
    breaker = CircuitBreaker("test_reset", failure_threshold=5)

    async def fail():
        raise RuntimeError("fail")

    async def succeed():
        return "ok"

    for _ in range(3):
        with pytest.raises(RuntimeError):
            await breaker.call(fail)

    assert breaker._failure_count == 3
    await breaker.call(succeed)
    assert breaker._failure_count == 0
    assert breaker.state == CircuitState.CLOSED




def test_get_breaker_returns_same_instance():
    b1 = get_breaker("provider_a")
    b2 = get_breaker("provider_a")
    assert b1 is b2


def test_get_stats():
    breaker = CircuitBreaker("test_stats", failure_threshold=3)
    stats = breaker.get_stats()
    assert stats["name"] == "test_stats"
    assert stats["state"] == "closed"
    assert stats["failure_count"] == 0
