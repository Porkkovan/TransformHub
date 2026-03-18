"""Unit tests for budget enforcement service (non-DB tests only)."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.budget_enforcement import BudgetEnforcer, BudgetExceeded
from datetime import datetime, timezone


def _make_budget(
    monthly_token_cap=None,
    monthly_spend_cap=None,
    hard_cap_enabled=False,
    alert_threshold=0.8,
):
    return {
        "id": "budget-1",
        "organization_id": "org-1",
        "monthly_token_cap": monthly_token_cap,
        "monthly_spend_cap": monthly_spend_cap,
        "hard_cap_enabled": hard_cap_enabled,
        "alert_threshold": alert_threshold,
        "current_period_start": datetime(2026, 3, 1, tzinfo=timezone.utc),
    }


@pytest.mark.asyncio
async def test_no_budget_passes_check():
    """If no org_id is provided, check_budget is a no-op."""
    enforcer = BudgetEnforcer()
    await enforcer.check_budget("")  # should not raise


@pytest.mark.asyncio
async def test_hard_cap_raises_when_exceeded():
    enforcer = BudgetEnforcer()
    budget = _make_budget(monthly_token_cap=100_000, hard_cap_enabled=True)

    with patch.object(enforcer, "_get_or_create_budget", new=AsyncMock(return_value=budget)):
        with patch.object(
            enforcer,
            "_get_period_totals",
            new=AsyncMock(return_value={"total_tokens": 99_000, "total_spend": 0.0}),
        ):
            # 99k + 10k estimated = 109k > 100k hard cap
            with pytest.raises(BudgetExceeded):
                await enforcer.check_budget("org-1", estimated_tokens=10_000)


@pytest.mark.asyncio
async def test_soft_cap_does_not_raise():
    enforcer = BudgetEnforcer()
    budget = _make_budget(monthly_token_cap=100_000, hard_cap_enabled=False)

    with patch.object(enforcer, "_get_or_create_budget", new=AsyncMock(return_value=budget)):
        with patch.object(
            enforcer,
            "_get_period_totals",
            new=AsyncMock(return_value={"total_tokens": 99_000, "total_spend": 0.0}),
        ):
            # Should log warning but NOT raise
            await enforcer.check_budget("org-1", estimated_tokens=10_000)


@pytest.mark.asyncio
async def test_spend_cap_raises_when_exceeded():
    enforcer = BudgetEnforcer()
    budget = _make_budget(monthly_spend_cap=50.0, hard_cap_enabled=True)

    with patch.object(enforcer, "_get_or_create_budget", new=AsyncMock(return_value=budget)):
        with patch.object(
            enforcer,
            "_get_period_totals",
            new=AsyncMock(return_value={"total_tokens": 0, "total_spend": 51.0}),
        ):
            with pytest.raises(BudgetExceeded):
                await enforcer.check_budget("org-1")


@pytest.mark.asyncio
async def test_get_usage_summary_no_budget():
    enforcer = BudgetEnforcer()
    with patch.object(enforcer, "_get_or_create_budget", new=AsyncMock(return_value=None)):
        result = await enforcer.get_usage_summary("org-1")
    assert result["budget"] is None
