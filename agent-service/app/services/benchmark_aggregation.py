"""
Cross-org anonymised benchmark aggregation.

Aggregates VSM metrics (flow efficiency, process time, wait time)
across organisations in the same industry_type, storing anonymised
percentiles in org_benchmarks.

Called:
- After each VSM agent run completes (async, non-blocking)
- Scheduled monthly by ARQ worker to refresh all benchmarks
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from app.core.database import db_pool

logger = logging.getLogger(__name__)


async def record_vsm_benchmark(
    org_id: str,
    industry_type: str,
    metrics: dict,
    period_month: str | None = None,
) -> None:
    """
    Record anonymised VSM metrics for an org into org_benchmarks.
    Called after lean_vsm agent completes.
    """
    if not org_id or not industry_type:
        return

    pm = period_month or datetime.now(timezone.utc).strftime("%Y-%m")

    capabilities = metrics.get("capabilities", [])
    if not capabilities:
        return

    # Aggregate across all capabilities
    flow_efficiencies = [c.get("flow_efficiency_pct", 0) for c in capabilities if c.get("flow_efficiency_pct")]
    avg_pt = sum(c.get("total_process_time_hours", 0) for c in capabilities) / max(len(capabilities), 1)
    avg_lt = sum(c.get("total_lead_time_hours", 0) for c in capabilities) / max(len(capabilities), 1)
    avg_fe = sum(flow_efficiencies) / max(len(flow_efficiencies), 1)

    benchmark_metrics = [
        ("avg_flow_efficiency_pct", avg_fe),
        ("avg_process_time_hrs",    avg_pt),
        ("avg_lead_time_hrs",       avg_lt),
    ]

    try:
        for metric_name, metric_value in benchmark_metrics:
            if metric_value <= 0:
                continue
            await db_pool.execute(
                """
                INSERT INTO org_benchmarks
                    (id, organization_id, industry_type, metric_name, metric_value,
                     agent_type, period_month, is_anonymized, created_at)
                VALUES ($1,$2,$3,$4,$5,'lean_vsm',$6,TRUE,NOW())
                ON CONFLICT DO NOTHING
                """,
                str(uuid.uuid4()),
                org_id,
                industry_type,
                metric_name,
                metric_value,
                pm,
            )
        logger.info("Recorded VSM benchmarks for org %s (%s)", org_id, industry_type)
    except Exception as exc:
        logger.warning("Failed to record VSM benchmark (non-fatal): %s", exc)


async def get_industry_benchmarks(
    industry_type: str,
    metric_name: str,
    exclude_org_id: str | None = None,
    lookback_months: int = 3,
) -> dict:
    """
    Return p25/p50/p75 percentile benchmarks for an industry+metric.
    Excludes the requesting org for privacy.
    """
    from_month = datetime.now(timezone.utc)
    months_back = []
    for i in range(lookback_months):
        y = from_month.year
        m = from_month.month - i
        while m <= 0:
            m += 12
            y -= 1
        months_back.append(f"{y:04d}-{m:02d}")

    params: list = [industry_type, metric_name, months_back]
    exclude_clause = ""
    if exclude_org_id:
        params.append(exclude_org_id)
        exclude_clause = f" AND organization_id != ${len(params)}"

    row = await db_pool.fetchrow(
        f"""
        SELECT
            COUNT(*) AS sample_size,
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY metric_value) AS p25,
            PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY metric_value) AS p50,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY metric_value) AS p75,
            AVG(metric_value) AS mean
        FROM org_benchmarks
        WHERE industry_type = $1
          AND metric_name    = $2
          AND period_month   = ANY($3)
          AND is_anonymized  = TRUE
          {exclude_clause}
        """,
        *params,
    )

    if not row or not row["sample_size"]:
        return {
            "industry_type": industry_type,
            "metric_name": metric_name,
            "sample_size": 0,
            "p25": None, "p50": None, "p75": None, "mean": None,
        }

    return {
        "industry_type": industry_type,
        "metric_name": metric_name,
        "sample_size": row["sample_size"],
        "p25": round(float(row["p25"]), 2) if row["p25"] is not None else None,
        "p50": round(float(row["p50"]), 2) if row["p50"] is not None else None,
        "p75": round(float(row["p75"]), 2) if row["p75"] is not None else None,
        "mean": round(float(row["mean"]), 2) if row["mean"] is not None else None,
    }
