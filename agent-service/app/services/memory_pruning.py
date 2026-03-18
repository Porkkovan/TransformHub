"""
Agent memory pruning strategy.

Prevents unbounded growth of agent_memories table by:
1. Capping per-org, per-agent memory to MAX_ENTRIES_PER_CONTEXT
2. Evicting oldest entries when cap is exceeded
3. Dropping entries with access_count = 0 after STALE_DAYS

Run as a background task triggered by ARQ worker on a schedule,
or called inline by the memory service on writes.
"""

from __future__ import annotations

import logging

from app.core.database import db_pool

logger = logging.getLogger(__name__)

MAX_ENTRIES_PER_CONTEXT = 500   # per org+agent_type combination
STALE_DAYS = 90                 # prune entries not accessed in 90 days


async def prune_agent_memories(
    org_id: str | None = None,
    agent_type: str | None = None,
    dry_run: bool = False,
) -> dict:
    """
    Prune stale / excess agent memories.

    If org_id/agent_type are None, runs across all orgs/types.
    Returns counts of pruned entries.
    """
    total_stale = 0
    total_overflow = 0

    # ── 1. Prune never-accessed entries older than STALE_DAYS ──────────────
    stale_filter = ""
    params = []
    if org_id:
        params.append(org_id)
        stale_filter += f" AND organization_id = ${len(params)}"
    if agent_type:
        params.append(agent_type)
        stale_filter += f" AND agent_type = ${len(params)}"

    stale_count = await db_pool.fetchval(
        f"""
        SELECT COUNT(*) FROM agent_memories
        WHERE access_count = 0
          AND updated_at < NOW() - INTERVAL '{STALE_DAYS} days'
          {stale_filter}
        """,
        *params,
    )
    total_stale = stale_count or 0
    logger.info("Stale agent memories (never accessed, >%dd): %d", STALE_DAYS, total_stale)

    if not dry_run and total_stale > 0:
        await db_pool.execute(
            f"""
            DELETE FROM agent_memories
            WHERE access_count = 0
              AND updated_at < NOW() - INTERVAL '{STALE_DAYS} days'
              {stale_filter}
            """,
            *params,
        )

    # ── 2. Cap per org+agent_type to MAX_ENTRIES_PER_CONTEXT ──────────────
    # Find groups exceeding the cap
    overflow_groups = await db_pool.fetch(
        """
        SELECT organization_id, agent_type, COUNT(*) AS cnt
        FROM agent_memories
        GROUP BY organization_id, agent_type
        HAVING COUNT(*) > $1
        """,
        MAX_ENTRIES_PER_CONTEXT,
    )

    for row in overflow_groups:
        grp_org_id = row["organization_id"]
        grp_agent_type = row["agent_type"]
        excess = row["cnt"] - MAX_ENTRIES_PER_CONTEXT

        logger.info(
            "Pruning %d excess memories for org=%s agent=%s",
            excess, grp_org_id, grp_agent_type,
        )
        total_overflow += excess

        if not dry_run:
            # Delete least-recently-used (lowest access_count, oldest updated_at)
            await db_pool.execute(
                """
                DELETE FROM agent_memories
                WHERE id IN (
                    SELECT id FROM agent_memories
                    WHERE organization_id = $1 AND agent_type = $2
                    ORDER BY access_count ASC, updated_at ASC
                    LIMIT $3
                )
                """,
                grp_org_id,
                grp_agent_type,
                excess,
            )

    return {
        "stale_pruned": total_stale if not dry_run else 0,
        "overflow_pruned": total_overflow if not dry_run else 0,
        "dry_run": dry_run,
        "would_prune": total_stale + total_overflow,
    }
