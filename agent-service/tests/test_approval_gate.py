"""
Tests for the ApprovalGate service.

Covers: request_approval, check_approval, approve, reject, list_approvals,
        and edge cases (not found, already resolved, JSON parsing).
"""

import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.approval_gate import ApprovalGate, ApprovalStatus


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def gate():
    """Return a fresh ApprovalGate instance for each test."""
    return ApprovalGate()


@pytest.fixture
def mock_deps():
    """
    Patch db_pool and event_bus at the module level used by ApprovalGate.
    Returns (mock_db, mock_bus) so tests can configure return values.
    """
    with (
        patch("app.services.approval_gate.db_pool") as mock_db,
        patch("app.services.approval_gate.event_bus") as mock_bus,
    ):
        mock_db.execute = AsyncMock(return_value="INSERT 1")
        mock_db.fetchrow = AsyncMock(return_value=None)
        mock_db.fetch = AsyncMock(return_value=[])
        mock_bus.publish = AsyncMock()
        yield mock_db, mock_bus


# ---------------------------------------------------------------------------
# request_approval
# ---------------------------------------------------------------------------


class TestRequestApproval:
    @pytest.mark.asyncio
    async def test_creates_approval_and_returns_id(self, gate, mock_deps):
        mock_db, mock_bus = mock_deps

        approval_id = await gate.request_approval(
            execution_id="exec-100",
            gate_name="transition_approval",
            agent_type="discovery",
            data_for_review={"summary": "Review this plan"},
        )

        # Returns a valid UUID string
        assert isinstance(approval_id, str)
        assert len(approval_id) == 36  # UUID format

        # Verify DB insert was called
        mock_db.execute.assert_awaited_once()
        call_args = mock_db.execute.call_args
        assert "INSERT INTO approval_requests" in call_args[0][0]
        assert call_args[0][1] == approval_id  # id
        assert call_args[0][2] == "exec-100"  # execution_id
        assert call_args[0][3] == "transition_approval"  # gate_name
        assert call_args[0][4] == "discovery"  # agent_type
        assert call_args[0][5] == "PENDING"  # status

        # Verify data_for_review is serialized as JSON
        data_json = call_args[0][6]
        parsed = json.loads(data_json)
        assert parsed["summary"] == "Review this plan"

    @pytest.mark.asyncio
    async def test_publishes_approval_requested_event(self, gate, mock_deps):
        mock_db, mock_bus = mock_deps

        approval_id = await gate.request_approval(
            execution_id="exec-200",
            gate_name="budget_review",
            agent_type="fiduciary",
            data_for_review={"budget": 50000},
        )

        mock_bus.publish.assert_awaited_once()
        channel, event = mock_bus.publish.call_args[0]
        assert channel == "pipeline:exec-200"
        assert event["type"] == "approval_requested"
        assert event["approval_id"] == approval_id
        assert event["gate_name"] == "budget_review"
        assert event["agent_type"] == "fiduciary"
        assert "timestamp" in event


# ---------------------------------------------------------------------------
# check_approval
# ---------------------------------------------------------------------------


class TestCheckApproval:
    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self, gate, mock_deps):
        mock_db, _ = mock_deps
        mock_db.fetchrow.return_value = None

        result = await gate.check_approval("nonexistent-id")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_approval_dict_when_found(self, gate, mock_deps):
        mock_db, _ = mock_deps

        # Simulate a DB row (asyncpg Record behaves like a dict-like)
        fake_row = {
            "id": "appr-1",
            "execution_id": "exec-100",
            "gate_name": "review_gate",
            "agent_type": "discovery",
            "status": "PENDING",
            "data_for_review": {"key": "value"},
            "reviewer_id": None,
            "reviewer_note": None,
            "created_at": "2026-01-15T10:00:00Z",
            "updated_at": "2026-01-15T10:00:00Z",
        }
        mock_db.fetchrow.return_value = MagicMock(**{"__iter__": lambda s: iter(fake_row), "items": fake_row.items, "keys": fake_row.keys, "values": fake_row.values, "__getitem__": fake_row.__getitem__, "get": fake_row.get})
        # Simpler approach: just return a dict directly since dict(row) should work
        mock_db.fetchrow.return_value = fake_row

        result = await gate.check_approval("appr-1")

        assert result is not None
        assert result["id"] == "appr-1"
        assert result["status"] == "PENDING"
        assert result["data_for_review"] == {"key": "value"}

    @pytest.mark.asyncio
    async def test_parses_json_string_data_for_review(self, gate, mock_deps):
        mock_db, _ = mock_deps

        fake_row = {
            "id": "appr-2",
            "execution_id": "exec-200",
            "gate_name": "review",
            "agent_type": "architecture",
            "status": "PENDING",
            "data_for_review": '{"budget": 100000}',  # String, not dict
            "reviewer_id": None,
            "reviewer_note": None,
            "created_at": "2026-01-15T10:00:00Z",
            "updated_at": "2026-01-15T10:00:00Z",
        }
        mock_db.fetchrow.return_value = fake_row

        result = await gate.check_approval("appr-2")
        assert result["data_for_review"] == {"budget": 100000}

    @pytest.mark.asyncio
    async def test_handles_invalid_json_in_data_for_review(self, gate, mock_deps):
        mock_db, _ = mock_deps

        fake_row = {
            "id": "appr-3",
            "execution_id": "exec-300",
            "gate_name": "review",
            "agent_type": "architecture",
            "status": "PENDING",
            "data_for_review": "not-valid-json{{{",
            "reviewer_id": None,
            "reviewer_note": None,
            "created_at": "2026-01-15T10:00:00Z",
            "updated_at": "2026-01-15T10:00:00Z",
        }
        mock_db.fetchrow.return_value = fake_row

        result = await gate.check_approval("appr-3")
        # Should keep the original string if JSON parsing fails
        assert result["data_for_review"] == "not-valid-json{{{"


# ---------------------------------------------------------------------------
# approve
# ---------------------------------------------------------------------------


class TestApprove:
    @pytest.mark.asyncio
    async def test_approves_pending_gate(self, gate, mock_deps):
        mock_db, mock_bus = mock_deps

        # check_approval returns PENDING gate
        pending_row = {
            "id": "appr-10",
            "execution_id": "exec-500",
            "gate_name": "deploy_gate",
            "agent_type": "architecture",
            "status": "PENDING",
            "data_for_review": {},
            "reviewer_id": None,
            "reviewer_note": None,
            "created_at": "2026-01-15T10:00:00Z",
            "updated_at": "2026-01-15T10:00:00Z",
        }
        mock_db.fetchrow.return_value = pending_row

        result = await gate.approve("appr-10", "user-42", "Looks good")

        assert result["approval_id"] == "appr-10"
        assert result["status"] == "APPROVED"
        assert result["reviewer_id"] == "user-42"
        assert result["note"] == "Looks good"

        # Verify UPDATE was executed
        assert mock_db.execute.await_count >= 1
        update_call = mock_db.execute.call_args_list[-1]
        assert "UPDATE approval_requests" in update_call[0][0]
        assert update_call[0][2] == "APPROVED"

    @pytest.mark.asyncio
    async def test_publishes_approval_approved_event(self, gate, mock_deps):
        mock_db, mock_bus = mock_deps

        pending_row = {
            "id": "appr-11",
            "execution_id": "exec-600",
            "gate_name": "budget_gate",
            "agent_type": "fiduciary",
            "status": "PENDING",
            "data_for_review": {},
            "reviewer_id": None,
            "reviewer_note": None,
            "created_at": "2026-01-15T10:00:00Z",
            "updated_at": "2026-01-15T10:00:00Z",
        }
        mock_db.fetchrow.return_value = pending_row

        await gate.approve("appr-11", "user-55", "Approved")

        mock_bus.publish.assert_awaited_once()
        channel, event = mock_bus.publish.call_args[0]
        assert channel == "pipeline:exec-600"
        assert event["type"] == "approval_approved"
        assert event["approval_id"] == "appr-11"
        assert event["reviewer_id"] == "user-55"

    @pytest.mark.asyncio
    async def test_raises_on_not_found(self, gate, mock_deps):
        mock_db, _ = mock_deps
        mock_db.fetchrow.return_value = None

        with pytest.raises(ValueError, match="not found"):
            await gate.approve("nonexistent", "user-1")

    @pytest.mark.asyncio
    async def test_raises_on_already_approved(self, gate, mock_deps):
        mock_db, _ = mock_deps

        already_approved = {
            "id": "appr-12",
            "execution_id": "exec-700",
            "gate_name": "test_gate",
            "agent_type": "discovery",
            "status": "APPROVED",
            "data_for_review": {},
            "reviewer_id": "user-old",
            "reviewer_note": "Already done",
            "created_at": "2026-01-15T10:00:00Z",
            "updated_at": "2026-01-15T10:00:00Z",
        }
        mock_db.fetchrow.return_value = already_approved

        with pytest.raises(ValueError, match="already APPROVED"):
            await gate.approve("appr-12", "user-new")

    @pytest.mark.asyncio
    async def test_falls_back_on_fk_constraint_error(self, gate, mock_deps):
        """When the first UPDATE fails (e.g., FK constraint on reviewed_by),
        the code retries without reviewer_id."""
        mock_db, mock_bus = mock_deps

        pending_row = {
            "id": "appr-13",
            "execution_id": "exec-800",
            "gate_name": "fk_gate",
            "agent_type": "discovery",
            "status": "PENDING",
            "data_for_review": {},
            "reviewer_id": None,
            "reviewer_note": None,
            "created_at": "2026-01-15T10:00:00Z",
            "updated_at": "2026-01-15T10:00:00Z",
        }
        mock_db.fetchrow.return_value = pending_row

        # First execute call (the UPDATE with reviewer_id) raises
        # Second call (the fallback UPDATE without reviewer_id) succeeds
        mock_db.execute.side_effect = [Exception("FK violation"), "UPDATE 1"]

        result = await gate.approve("appr-13", "unknown-user", "note")

        assert result["status"] == "APPROVED"
        assert mock_db.execute.await_count == 2  # called twice (fail + retry)


# ---------------------------------------------------------------------------
# reject
# ---------------------------------------------------------------------------


class TestReject:
    @pytest.mark.asyncio
    async def test_rejects_pending_gate(self, gate, mock_deps):
        mock_db, mock_bus = mock_deps

        pending_row = {
            "id": "appr-20",
            "execution_id": "exec-900",
            "gate_name": "compliance_gate",
            "agent_type": "risk_compliance",
            "status": "PENDING",
            "data_for_review": {},
            "reviewer_id": None,
            "reviewer_note": None,
            "created_at": "2026-01-15T10:00:00Z",
            "updated_at": "2026-01-15T10:00:00Z",
        }
        mock_db.fetchrow.return_value = pending_row

        result = await gate.reject("appr-20", "user-77", "Not compliant")

        assert result["approval_id"] == "appr-20"
        assert result["status"] == "REJECTED"
        assert result["reviewer_id"] == "user-77"
        assert result["note"] == "Not compliant"

    @pytest.mark.asyncio
    async def test_publishes_rejection_event(self, gate, mock_deps):
        mock_db, mock_bus = mock_deps

        pending_row = {
            "id": "appr-21",
            "execution_id": "exec-1000",
            "gate_name": "security_gate",
            "agent_type": "security",
            "status": "PENDING",
            "data_for_review": {},
            "reviewer_id": None,
            "reviewer_note": None,
            "created_at": "2026-01-15T10:00:00Z",
            "updated_at": "2026-01-15T10:00:00Z",
        }
        mock_db.fetchrow.return_value = pending_row

        await gate.reject("appr-21", "user-88", "Security issue found")

        mock_bus.publish.assert_awaited_once()
        channel, event = mock_bus.publish.call_args[0]
        assert channel == "pipeline:exec-1000"
        assert event["type"] == "approval_rejected"
        assert event["note"] == "Security issue found"

    @pytest.mark.asyncio
    async def test_raises_on_already_rejected(self, gate, mock_deps):
        mock_db, _ = mock_deps

        already_rejected = {
            "id": "appr-22",
            "execution_id": "exec-1100",
            "gate_name": "test_gate",
            "agent_type": "discovery",
            "status": "REJECTED",
            "data_for_review": {},
            "reviewer_id": "user-old",
            "reviewer_note": "Nope",
            "created_at": "2026-01-15T10:00:00Z",
            "updated_at": "2026-01-15T10:00:00Z",
        }
        mock_db.fetchrow.return_value = already_rejected

        with pytest.raises(ValueError, match="already REJECTED"):
            await gate.reject("appr-22", "user-new")

    @pytest.mark.asyncio
    async def test_default_empty_note(self, gate, mock_deps):
        mock_db, mock_bus = mock_deps

        pending_row = {
            "id": "appr-23",
            "execution_id": "exec-1200",
            "gate_name": "test_gate",
            "agent_type": "discovery",
            "status": "PENDING",
            "data_for_review": {},
            "reviewer_id": None,
            "reviewer_note": None,
            "created_at": "2026-01-15T10:00:00Z",
            "updated_at": "2026-01-15T10:00:00Z",
        }
        mock_db.fetchrow.return_value = pending_row

        result = await gate.reject("appr-23", "user-99")
        assert result["note"] == ""


# ---------------------------------------------------------------------------
# list_approvals
# ---------------------------------------------------------------------------


class TestListApprovals:
    @pytest.mark.asyncio
    async def test_returns_empty_list_when_no_approvals(self, gate, mock_deps):
        mock_db, _ = mock_deps
        mock_db.fetch.return_value = []

        result = await gate.list_approvals()
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_mapped_approval_list(self, gate, mock_deps):
        mock_db, _ = mock_deps

        fake_rows = [
            {
                "id": "appr-30",
                "execution_id": "exec-2000",
                "gate_name": "review_a",
                "agent_type": "discovery",
                "status": "PENDING",
                "data_for_review": {"key": "val"},
                "reviewer_id": None,
                "reviewer_note": None,
                "created_at": "2026-01-15T10:00:00Z",
                "updated_at": "2026-01-15T10:00:00Z",
            },
            {
                "id": "appr-31",
                "execution_id": "exec-2000",
                "gate_name": "review_b",
                "agent_type": "architecture",
                "status": "APPROVED",
                "data_for_review": '{"risk": 5}',  # JSON string
                "reviewer_id": "user-50",
                "reviewer_note": "OK",
                "created_at": "2026-01-15T09:00:00Z",
                "updated_at": "2026-01-15T09:30:00Z",
            },
        ]
        mock_db.fetch.return_value = fake_rows

        result = await gate.list_approvals(execution_id="exec-2000")

        assert len(result) == 2
        assert result[0]["id"] == "appr-30"
        # JSON string should be parsed
        assert result[1]["data_for_review"] == {"risk": 5}

    @pytest.mark.asyncio
    async def test_filters_by_execution_id(self, gate, mock_deps):
        mock_db, _ = mock_deps
        mock_db.fetch.return_value = []

        await gate.list_approvals(execution_id="exec-filter")

        call_args = mock_db.fetch.call_args
        query = call_args[0][0]
        assert "execution_id = $1" in query
        # execution_id should be the first positional arg after query
        assert call_args[0][1] == "exec-filter"

    @pytest.mark.asyncio
    async def test_filters_by_status(self, gate, mock_deps):
        mock_db, _ = mock_deps
        mock_db.fetch.return_value = []

        await gate.list_approvals(status="PENDING")

        call_args = mock_db.fetch.call_args
        query = call_args[0][0]
        assert "status = $1" in query
        assert call_args[0][1] == "PENDING"

    @pytest.mark.asyncio
    async def test_filters_by_both_execution_id_and_status(self, gate, mock_deps):
        mock_db, _ = mock_deps
        mock_db.fetch.return_value = []

        await gate.list_approvals(execution_id="exec-both", status="APPROVED")

        call_args = mock_db.fetch.call_args
        query = call_args[0][0]
        assert "execution_id = $1" in query
        assert "status = $2" in query
        assert call_args[0][1] == "exec-both"
        assert call_args[0][2] == "APPROVED"

    @pytest.mark.asyncio
    async def test_respects_limit_and_offset(self, gate, mock_deps):
        mock_db, _ = mock_deps
        mock_db.fetch.return_value = []

        await gate.list_approvals(limit=10, offset=20)

        call_args = mock_db.fetch.call_args
        # With no filters, limit is $1 and offset is $2
        assert call_args[0][1] == 10  # limit
        assert call_args[0][2] == 20  # offset

    @pytest.mark.asyncio
    async def test_default_limit_and_offset(self, gate, mock_deps):
        mock_db, _ = mock_deps
        mock_db.fetch.return_value = []

        await gate.list_approvals()

        call_args = mock_db.fetch.call_args
        # Default: limit=50, offset=0
        assert call_args[0][1] == 50
        assert call_args[0][2] == 0
