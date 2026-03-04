"""Tests for retry policy and execution helper."""

import pytest
from app.services.retry import RetryPolicy, execute_with_retry


def test_default_policy_values():
    policy = RetryPolicy()
    assert policy.max_attempts == 3
    assert policy.base_delay == 30.0
    assert policy.max_delay == 300.0
    assert policy.exponential_base == 2.0


def test_get_delay_exponential_backoff():
    policy = RetryPolicy(base_delay=1.0, exponential_base=2.0, max_delay=100.0)
    # delay = base_delay * (exponential_base ** attempt)
    assert policy.get_delay(0) == 1.0   # 1.0 * 2^0 = 1.0
    assert policy.get_delay(1) == 2.0   # 1.0 * 2^1 = 2.0
    assert policy.get_delay(2) == 4.0   # 1.0 * 2^2 = 4.0
    assert policy.get_delay(3) == 8.0   # 1.0 * 2^3 = 8.0


def test_get_delay_capped_at_max():
    policy = RetryPolicy(base_delay=1.0, exponential_base=2.0, max_delay=5.0)
    assert policy.get_delay(10) == 5.0


@pytest.mark.asyncio
async def test_execute_with_retry_success_first_try():
    call_count = 0

    async def succeed():
        nonlocal call_count
        call_count += 1
        return "ok"

    policy = RetryPolicy(max_attempts=3, base_delay=0.01)
    result = await execute_with_retry(policy, succeed)
    assert result == "ok"
    assert call_count == 1


@pytest.mark.asyncio
async def test_execute_with_retry_succeeds_after_failures():
    call_count = 0

    async def fail_twice():
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise ValueError("not yet")
        return "ok"

    policy = RetryPolicy(max_attempts=3, base_delay=0.01)
    result = await execute_with_retry(policy, fail_twice)
    assert result == "ok"
    assert call_count == 3


@pytest.mark.asyncio
async def test_execute_with_retry_exhausts_attempts():
    async def always_fail():
        raise RuntimeError("boom")

    policy = RetryPolicy(max_attempts=2, base_delay=0.01)
    with pytest.raises(RuntimeError, match="boom"):
        await execute_with_retry(policy, always_fail)
