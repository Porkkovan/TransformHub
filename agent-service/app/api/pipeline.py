"""
FastAPI router for pipeline execution and status.

Endpoints:
  POST /pipeline/execute   — kick off the full agent pipeline
  GET  /pipeline/status/{id} — retrieve pipeline + per-agent status
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from app.agents.pipeline.dag import default_pipeline
from app.agents.pipeline.graph import execute_pipeline
from app.core.database import db_pool

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class PipelineExecuteRequest(BaseModel):
    repository_url: Optional[str] = None
    repository_id: Optional[str] = None
    input_data: dict[str, Any] = Field(default_factory=dict)
    halt_on_failure: bool = True


class PipelineExecuteResponse(BaseModel):
    pipeline_execution_id: str
    status: str
    message: str
    layers: list[list[str]]


class AgentStatusEntry(BaseModel):
    agent_type: str
    status: str
    output: Optional[dict[str, Any]] = None
    error_message: Optional[str] = None
    updated_at: Optional[datetime] = None


class PipelineStatusResponse(BaseModel):
    pipeline_execution_id: str
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    agents: list[AgentStatusEntry] = []


# ---------------------------------------------------------------------------
# Background task
# ---------------------------------------------------------------------------

async def _run_pipeline(
    pipeline_execution_id: str,
    input_data: dict[str, Any],
    halt_on_failure: bool,
) -> None:
    """Background task that runs the full pipeline and updates the DB row."""
    try:
        await db_pool.execute(
            """
            UPDATE pipeline_executions
            SET status = 'RUNNING', started_at = NOW(), updated_at = NOW()
            WHERE id = $1
            """,
            pipeline_execution_id,
        )

        results = await execute_pipeline(
            pipeline_execution_id,
            input_data,
            halt_on_failure=halt_on_failure,
        )

        # Check for any agent-level failures
        failed = [k for k, v in results.items() if isinstance(v, dict) and "error" in v]
        status = "COMPLETED" if not failed else "FAILED"
        error_msg = (
            f"Agents failed: {', '.join(failed)}" if failed else None
        )

        await db_pool.execute(
            """
            UPDATE pipeline_executions
            SET status = $2, output = $3::jsonb,
                error_message = $4, completed_at = NOW(), updated_at = NOW()
            WHERE id = $1
            """,
            pipeline_execution_id,
            status,
            json.dumps(results, default=str),
            error_msg,
        )

    except Exception as exc:
        await db_pool.execute(
            """
            UPDATE pipeline_executions
            SET status = 'FAILED', error_message = $2,
                completed_at = NOW(), updated_at = NOW()
            WHERE id = $1
            """,
            pipeline_execution_id,
            str(exc),
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/execute", response_model=PipelineExecuteResponse, status_code=202)
async def execute_pipeline_endpoint(
    request: PipelineExecuteRequest,
    background_tasks: BackgroundTasks,
):
    """Kick off the full TransformHub agent pipeline."""
    pipeline_execution_id = str(uuid.uuid4())

    # Merge repository info into input_data
    input_data = {**request.input_data}
    if request.repository_url:
        input_data["repository_url"] = request.repository_url
    if request.repository_id:
        input_data["repository_id"] = request.repository_id

    # Persist pipeline execution record
    await db_pool.execute(
        """
        INSERT INTO pipeline_executions
            (id, status, input, created_at, updated_at)
        VALUES ($1, 'PENDING', $2::jsonb, NOW(), NOW())
        """,
        pipeline_execution_id,
        json.dumps(input_data),
    )

    layers = [g.agents for g in default_pipeline.parallel_groups()]

    background_tasks.add_task(
        _run_pipeline,
        pipeline_execution_id,
        input_data,
        request.halt_on_failure,
    )

    return PipelineExecuteResponse(
        pipeline_execution_id=pipeline_execution_id,
        status="PENDING",
        message="Pipeline execution queued",
        layers=layers,
    )


@router.get("/status/{pipeline_execution_id}", response_model=PipelineStatusResponse)
async def get_pipeline_status(pipeline_execution_id: str):
    """Retrieve the pipeline execution status including per-agent breakdown."""
    row = await db_pool.fetchrow(
        """
        SELECT id, status, started_at, completed_at, error_message
        FROM pipeline_executions
        WHERE id = $1
        """,
        pipeline_execution_id,
    )

    if not row:
        raise HTTPException(status_code=404, detail="Pipeline execution not found")

    # Fetch per-agent statuses
    agent_rows = await db_pool.fetch(
        """
        SELECT agent_type, status, output, error_message, updated_at
        FROM pipeline_agent_statuses
        WHERE pipeline_execution_id = $1
        ORDER BY updated_at ASC
        """,
        pipeline_execution_id,
    )

    agents: list[AgentStatusEntry] = []
    for arow in agent_rows:
        output = arow["output"]
        if output and isinstance(output, str):
            try:
                output = json.loads(output)
            except json.JSONDecodeError:
                output = None
        agents.append(
            AgentStatusEntry(
                agent_type=arow["agent_type"],
                status=arow["status"],
                output=output if isinstance(output, dict) else None,
                error_message=arow["error_message"],
                updated_at=arow["updated_at"],
            )
        )

    return PipelineStatusResponse(
        pipeline_execution_id=row["id"],
        status=row["status"],
        started_at=row["started_at"],
        completed_at=row["completed_at"],
        error_message=row["error_message"],
        agents=agents,
    )
