"""
ApprovalGate service for human-in-the-loop gating within the pipeline.

Agents that reach a decision point can request approval before proceeding.
Reviewers approve or reject through the approvals API, and the pipeline
resumes or halts accordingly.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from app.core.database import db_pool
from app.services.event_bus import event_bus

logger = logging.getLogger(__name__)


class ApprovalStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ApprovalGate:
    """
    Manages human-in-the-loop approval gates.

    Workflow:
      1. An agent calls ``request_approval`` to create a gate record.
      2. A human reviewer sees the pending approval in the UI.
      3. The reviewer calls ``approve`` or ``reject``.
      4. The pipeline checks ``check_approval`` and proceeds (or halts).
    """

    # ------------------------------------------------------------------
    # Request approval
    # ------------------------------------------------------------------

    async def request_approval(
        self,
        execution_id: str,
        gate_name: str,
        agent_type: str,
        data_for_review: dict[str, Any],
    ) -> str:
        """Create a new approval gate record.

        Parameters
        ----------
        execution_id:
            The pipeline execution that is paused.
        gate_name:
            A descriptive name for this gate, e.g. ``"transition_approval"``.
        agent_type:
            Which agent is requesting the gate.
        data_for_review:
            The payload the reviewer should see to make a decision.

        Returns
        -------
        str
            The ``approval_id`` for this gate.
        """
        approval_id = str(uuid.uuid4())

        await db_pool.execute(
            """
            INSERT INTO approval_requests
                (id, execution_id, gate_name, agent_type, status,
                 data_for_review, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW())
            """,
            approval_id,
            execution_id,
            gate_name,
            agent_type,
            ApprovalStatus.PENDING.value,
            json.dumps(data_for_review, default=str),
        )

        # Notify listeners
        await event_bus.publish(f"pipeline:{execution_id}", {
            "type": "approval_requested",
            "approval_id": approval_id,
            "gate_name": gate_name,
            "agent_type": agent_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        logger.info(
            "Approval requested: id=%s gate=%s agent=%s execution=%s",
            approval_id,
            gate_name,
            agent_type,
            execution_id,
        )

        return approval_id

    # ------------------------------------------------------------------
    # Check approval status
    # ------------------------------------------------------------------

    async def check_approval(
        self,
        approval_id: str,
    ) -> Optional[dict[str, Any]]:
        """Return the current state of an approval gate, or ``None`` if not found."""
        row = await db_pool.fetchrow(
            """
            SELECT id, execution_id, gate_name, agent_type, status,
                   data_for_review, reviewed_by AS reviewer_id, review_note AS reviewer_note,
                   created_at, updated_at
            FROM approval_requests
            WHERE id = $1
            """,
            approval_id,
        )

        if not row:
            return None

        result = dict(row)
        # Parse jsonb columns if returned as string
        if isinstance(result.get("data_for_review"), str):
            try:
                result["data_for_review"] = json.loads(result["data_for_review"])
            except json.JSONDecodeError:
                pass

        return result

    # ------------------------------------------------------------------
    # Approve
    # ------------------------------------------------------------------

    async def approve(
        self,
        approval_id: str,
        reviewer_id: str,
        note: str = "",
    ) -> dict[str, Any]:
        """Mark an approval gate as APPROVED.

        Raises ``ValueError`` if the gate is not in PENDING status.
        """
        return await self._resolve(
            approval_id,
            ApprovalStatus.APPROVED,
            reviewer_id,
            note,
        )

    # ------------------------------------------------------------------
    # Reject
    # ------------------------------------------------------------------

    async def reject(
        self,
        approval_id: str,
        reviewer_id: str,
        note: str = "",
    ) -> dict[str, Any]:
        """Mark an approval gate as REJECTED.

        Raises ``ValueError`` if the gate is not in PENDING status.
        """
        return await self._resolve(
            approval_id,
            ApprovalStatus.REJECTED,
            reviewer_id,
            note,
        )

    # ------------------------------------------------------------------
    # List approvals
    # ------------------------------------------------------------------

    async def list_approvals(
        self,
        *,
        execution_id: str | None = None,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """List approval gates with optional filters."""
        conditions: list[str] = []
        args: list[Any] = []
        idx = 1

        if execution_id:
            conditions.append(f"execution_id = ${idx}")
            args.append(execution_id)
            idx += 1

        if status:
            conditions.append(f"status = ${idx}")
            args.append(status)
            idx += 1

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        query = f"""
            SELECT id, execution_id, gate_name, agent_type, status,
                   data_for_review, reviewed_by AS reviewer_id, review_note AS reviewer_note,
                   created_at, updated_at
            FROM approval_requests
            {where}
            ORDER BY created_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
        """
        args.extend([limit, offset])

        rows = await db_pool.fetch(query, *args)

        results: list[dict[str, Any]] = []
        for row in rows:
            entry = dict(row)
            if isinstance(entry.get("data_for_review"), str):
                try:
                    entry["data_for_review"] = json.loads(entry["data_for_review"])
                except json.JSONDecodeError:
                    pass
            results.append(entry)

        return results

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    async def _resolve(
        self,
        approval_id: str,
        new_status: ApprovalStatus,
        reviewer_id: str,
        note: str,
    ) -> dict[str, Any]:
        """Transition an approval gate from PENDING to the given status."""

        # Verify current status
        current = await self.check_approval(approval_id)
        if current is None:
            raise ValueError(f"Approval gate '{approval_id}' not found")
        if current["status"] != ApprovalStatus.PENDING.value:
            raise ValueError(
                f"Approval gate '{approval_id}' is already {current['status']}"
            )

        try:
            await db_pool.execute(
                """
                UPDATE approval_requests
                SET status = $2,
                    reviewed_by = $3,
                    review_note = $4,
                    updated_at = NOW()
                WHERE id = $1
                """,
                approval_id,
                new_status.value,
                reviewer_id,
                note,
            )
        except Exception:
            # FK constraint on reviewed_by — retry without reviewer_id
            await db_pool.execute(
                """
                UPDATE approval_requests
                SET status = $2,
                    review_note = $3,
                    updated_at = NOW()
                WHERE id = $1
                """,
                approval_id,
                new_status.value,
                note,
            )

        # Publish event
        execution_id = current["execution_id"]
        await event_bus.publish(f"pipeline:{execution_id}", {
            "type": f"approval_{new_status.value.lower()}",
            "approval_id": approval_id,
            "gate_name": current["gate_name"],
            "reviewer_id": reviewer_id,
            "note": note,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        logger.info(
            "Approval %s: id=%s gate=%s reviewer=%s",
            new_status.value,
            approval_id,
            current["gate_name"],
            reviewer_id,
        )

        return {
            "approval_id": approval_id,
            "status": new_status.value,
            "reviewer_id": reviewer_id,
            "note": note,
        }


# Module-level singleton
approval_gate = ApprovalGate()
