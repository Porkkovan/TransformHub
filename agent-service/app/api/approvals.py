"""
FastAPI router for the approval gates CRUD.

Endpoints:
  GET  /approvals             — list approvals (filterable by status, execution_id)
  GET  /approvals/{id}        — get a single approval gate
  POST /approvals/{id}/approve — approve a gate
  POST /approvals/{id}/reject  — reject a gate
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.approval_gate import approval_gate

router = APIRouter(prefix="/approvals", tags=["approvals"])


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class ApprovalResponse(BaseModel):
    id: str
    execution_id: str
    gate_name: str
    agent_type: str
    status: str
    data_for_review: Optional[dict[str, Any]] = None
    reviewer_id: Optional[str] = None
    reviewer_note: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CreateApprovalRequest(BaseModel):
    execution_id: str = Field(..., min_length=1)
    gate_name: str = Field(..., min_length=1)
    agent_type: str = Field(..., min_length=1)
    data_for_review: Optional[dict[str, Any]] = None


class ApprovalActionRequest(BaseModel):
    reviewer_id: str = Field(..., min_length=1, description="ID of the person approving/rejecting")
    note: str = Field(default="", description="Optional reviewer note")


class ApprovalActionResponse(BaseModel):
    approval_id: str
    status: str
    reviewer_id: str
    note: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _row_to_response(row: dict[str, Any]) -> ApprovalResponse:
    return ApprovalResponse(
        id=row["id"],
        execution_id=row["execution_id"],
        gate_name=row["gate_name"],
        agent_type=row["agent_type"],
        status=row["status"],
        data_for_review=row.get("data_for_review"),
        reviewer_id=row.get("reviewer_id"),
        reviewer_note=row.get("reviewer_note"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[ApprovalResponse])
async def list_approvals(
    status: Optional[str] = Query(None, description="Filter by status: PENDING, APPROVED, REJECTED"),
    execution_id: Optional[str] = Query(None, description="Filter by pipeline execution ID"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List approval gates with optional filtering."""
    rows = await approval_gate.list_approvals(
        execution_id=execution_id,
        status=status,
        limit=limit,
        offset=offset,
    )
    return [_row_to_response(r) for r in rows]


@router.post("", response_model=ApprovalResponse)
async def create_approval(request: CreateApprovalRequest):
    """Create a new approval gate for an execution."""
    try:
        approval_id = await approval_gate.request_approval(
            execution_id=request.execution_id,
            gate_name=request.gate_name,
            agent_type=request.agent_type,
            data_for_review=request.data_for_review or {},
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    row = await approval_gate.check_approval(approval_id)
    if row is None:
        raise HTTPException(status_code=500, detail="Failed to create approval gate")
    return _row_to_response(row)


@router.get("/{approval_id}", response_model=ApprovalResponse)
async def get_approval(approval_id: str):
    """Get a single approval gate by ID."""
    row = await approval_gate.check_approval(approval_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Approval gate not found")
    return _row_to_response(row)


@router.post("/{approval_id}/approve", response_model=ApprovalActionResponse)
async def approve_gate(approval_id: str, request: ApprovalActionRequest):
    """Approve a pending gate."""
    try:
        result = await approval_gate.approve(
            approval_id=approval_id,
            reviewer_id=request.reviewer_id,
            note=request.note,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return ApprovalActionResponse(**result)


@router.post("/{approval_id}/reject", response_model=ApprovalActionResponse)
async def reject_gate(approval_id: str, request: ApprovalActionRequest):
    """Reject a pending gate."""
    try:
        result = await approval_gate.reject(
            approval_id=approval_id,
            reviewer_id=request.reviewer_id,
            note=request.note,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return ApprovalActionResponse(**result)
