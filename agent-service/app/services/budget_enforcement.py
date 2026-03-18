"""
Per-organisation LLM token budget enforcement.

- Records every LLM call's token usage to org_llm_usage table.
- Checks monthly budget before allowing execution.
- Sends alert when usage crosses alert_threshold.
- Raises BudgetExceeded when hard_cap_enabled and limit is reached.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.core.database import db_pool

logger = logging.getLogger(__name__)


class BudgetExceeded(Exception):
    """Raised when an org has hit its hard monthly token/spend cap."""

    def __init__(self, org_id: str, reason: str) -> None:
        self.org_id = org_id
        super().__init__(f"Budget exceeded for org {org_id}: {reason}")


class BudgetEnforcer:
    """Checks and records LLM usage against per-org budgets."""

    # ---------------------------------------------------------------------------
    # Pre-call check
    # ---------------------------------------------------------------------------

    async def check_budget(self, org_id: str, estimated_tokens: int = 10_000) -> None:
        """
        Called before an agent execution starts.
        Raises BudgetExceeded if hard cap is enabled and would be breached.
        Logs a warning if alert threshold is crossed.
        """
        if not org_id:
            return

        budget = await self._get_or_create_budget(org_id)
        if not budget:
            return

        period_start = budget["current_period_start"]
        totals = await self._get_period_totals(org_id, period_start)

        current_tokens = totals["total_tokens"]
        current_spend = totals["total_spend"]

        # Token cap check
        if budget["monthly_token_cap"]:
            cap = budget["monthly_token_cap"]
            projected = current_tokens + estimated_tokens
            if projected > cap and budget["hard_cap_enabled"]:
                raise BudgetExceeded(
                    org_id,
                    f"Token cap {cap:,} would be exceeded (current={current_tokens:,}, "
                    f"estimated={estimated_tokens:,})",
                )
            usage_ratio = projected / cap
            if usage_ratio >= budget["alert_threshold"]:
                logger.warning(
                    "Org %s LLM token usage at %.0f%% of monthly cap (%d/%d)",
                    org_id,
                    usage_ratio * 100,
                    projected,
                    cap,
                )

        # Spend cap check
        if budget["monthly_spend_cap"]:
            cap_usd = budget["monthly_spend_cap"]
            if current_spend >= cap_usd and budget["hard_cap_enabled"]:
                raise BudgetExceeded(
                    org_id,
                    f"Spend cap ${cap_usd:.2f} exceeded (current=${current_spend:.4f})",
                )
            if cap_usd and current_spend / cap_usd >= budget["alert_threshold"]:
                logger.warning(
                    "Org %s LLM spend at %.0f%% of monthly cap ($%.2f/$%.2f)",
                    org_id,
                    (current_spend / cap_usd) * 100,
                    current_spend,
                    cap_usd,
                )

    # ---------------------------------------------------------------------------
    # Post-call recording
    # ---------------------------------------------------------------------------

    async def record_usage(
        self,
        org_id: str,
        agent_type: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cost_usd: float,
        execution_id: Optional[str] = None,
    ) -> None:
        """Persist a single LLM call's token usage."""
        if not org_id:
            return

        try:
            budget = await self._get_or_create_budget(org_id)
            if not budget:
                return

            await db_pool.execute(
                """
                INSERT INTO org_llm_usage
                    (id, organization_id, budget_id, agent_type, model,
                     input_tokens, output_tokens, cost_usd, execution_id, created_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
                """,
                str(uuid.uuid4()),
                org_id,
                budget["id"],
                agent_type,
                model,
                input_tokens,
                output_tokens,
                cost_usd,
                execution_id,
            )
        except Exception:
            logger.exception("Failed to record LLM usage for org %s", org_id)

    # ---------------------------------------------------------------------------
    # Dashboard summary
    # ---------------------------------------------------------------------------

    async def get_usage_summary(self, org_id: str) -> dict:
        """Return current-period usage summary for an org."""
        budget = await self._get_or_create_budget(org_id)
        if not budget:
            return {"org_id": org_id, "budget": None, "usage": None}

        totals = await self._get_period_totals(org_id, budget["current_period_start"])

        return {
            "org_id": org_id,
            "period_start": budget["current_period_start"].isoformat(),
            "monthly_token_cap": budget["monthly_token_cap"],
            "monthly_spend_cap": budget["monthly_spend_cap"],
            "hard_cap_enabled": budget["hard_cap_enabled"],
            "alert_threshold": budget["alert_threshold"],
            "current_tokens": totals["total_tokens"],
            "current_spend_usd": round(totals["total_spend"], 4),
            "token_usage_pct": (
                round(totals["total_tokens"] / budget["monthly_token_cap"] * 100, 1)
                if budget["monthly_token_cap"]
                else None
            ),
            "spend_usage_pct": (
                round(totals["total_spend"] / budget["monthly_spend_cap"] * 100, 1)
                if budget["monthly_spend_cap"]
                else None
            ),
        }

    # ---------------------------------------------------------------------------
    # Helpers
    # ---------------------------------------------------------------------------

    async def _get_or_create_budget(self, org_id: str) -> Optional[dict]:
        row = await db_pool.fetchrow(
            "SELECT * FROM org_llm_budgets WHERE organization_id = $1", org_id
        )
        if row:
            return dict(row)

        # Auto-create an unlimited budget so usage is always tracked
        now = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        budget_id = str(uuid.uuid4())
        try:
            await db_pool.execute(
                """
                INSERT INTO org_llm_budgets
                    (id, organization_id, current_period_start, created_at, updated_at)
                VALUES ($1, $2, $3, NOW(), NOW())
                ON CONFLICT (organization_id) DO NOTHING
                """,
                budget_id,
                org_id,
                now,
            )
        except Exception:
            pass  # concurrent insert is fine

        row = await db_pool.fetchrow(
            "SELECT * FROM org_llm_budgets WHERE organization_id = $1", org_id
        )
        return dict(row) if row else None

    async def _get_period_totals(self, org_id: str, period_start: datetime) -> dict:
        row = await db_pool.fetchrow(
            """
            SELECT
                COALESCE(SUM(input_tokens + output_tokens), 0) AS total_tokens,
                COALESCE(SUM(cost_usd), 0.0)                   AS total_spend
            FROM org_llm_usage
            WHERE organization_id = $1
              AND created_at >= $2
            """,
            org_id,
            period_start,
        )
        return dict(row) if row else {"total_tokens": 0, "total_spend": 0.0}


# Module-level singleton
budget_enforcer = BudgetEnforcer()
