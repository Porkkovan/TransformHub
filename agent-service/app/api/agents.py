import asyncio
import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)

from app.agents.orchestrator import run_agent
from app.models.schemas import (
    AgentExecuteRequest,
    AgentExecuteResponse,
    AgentResultsResponse,
    AgentStatusResponse,
)
from app.services.execution_store import execution_store
from app.services.event_bus import event_bus
from app.services.budget_enforcement import BudgetExceeded, budget_enforcer
from app.services.llm_router import set_org_anthropic_key

router = APIRouter(prefix="/agents", tags=["agents"])

VALID_AGENT_TYPES = {
    "discovery",
    "lean_vsm",
    "risk_compliance",
    "fiduciary",
    "market_intelligence",
    "architecture",
    "data_governance",
    "product_transformation",
    "backlog_okr",
    "future_state_vision",
    "git_integration",
    "testing_validation",
    "cost_estimation",
    "change_impact",
    "documentation",
    "monitoring",
    "security",
    "skill_gap",
}


async def _load_org_api_key(org_id: str) -> str | None:
    """Look up a per-org Anthropic API key from org_llm_budgets.

    Returns the key if set, or None to fall back to global ANTHROPIC_API_KEY.
    Errors are swallowed so a missing DB row never blocks agent execution.
    """
    try:
        from app.core.database import db_pool
        row = await db_pool.fetchrow(
            "SELECT anthropic_api_key FROM org_llm_budgets WHERE organization_id = $1",
            org_id,
        )
        return row["anthropic_api_key"] if row else None
    except Exception as e:
        logger.warning("Could not load per-org API key for %s: %s", org_id, e)
        return None


async def _execute_agent(execution_id: str, agent_type: str, input_data: dict, repository_id: str | None = None):
    channel = f"execution:{execution_id}"

    # Small delay to ensure the INSERT has committed before we UPDATE
    await asyncio.sleep(0.1)

    # Inject repository_id so agents can reference the pre-created repo record
    if repository_id:
        input_data = {**input_data, "repository_id": repository_id}

    # P3: Apply per-org Anthropic API key if configured
    org_id = (input_data.get("organization") or {}).get("id") or input_data.get("organizationId")
    if org_id:
        org_key = await _load_org_api_key(org_id)
        if org_key:
            set_org_anthropic_key(org_key)

    try:
        try:
            await execution_store.mark_running(execution_id)
        except Exception as mark_err:
            logger.warning("mark_running failed (non-fatal): %s", mark_err)

        await event_bus.publish(channel, {
            "type": "status",
            "status": "RUNNING",
            "agent_type": agent_type,
            "execution_id": execution_id,
        })

        result = await run_agent(agent_type, input_data)

        try:
            await execution_store.mark_completed(execution_id, result)
        except Exception as mark_err:
            logger.warning("mark_completed failed (non-fatal): %s", mark_err)

        await event_bus.publish(channel, {
            "type": "completed",
            "status": "COMPLETED",
            "execution_id": execution_id,
            "output": result,
        })
    except Exception as e:
        logger.error("Agent %s execution failed: %s", agent_type, e)
        try:
            await execution_store.mark_failed(execution_id, str(e))
        except Exception as mark_err:
            logger.warning("mark_failed failed (non-fatal): %s", mark_err)
        await event_bus.publish(channel, {
            "type": "error",
            "status": "FAILED",
            "execution_id": execution_id,
            "error": str(e),
        })
    finally:
        await event_bus.close_channel(channel)
        # Clear per-org API key from context to avoid leakage into any callbacks
        set_org_anthropic_key(None)


@router.post("/execute", response_model=AgentExecuteResponse, status_code=202)
async def execute_agent(request: AgentExecuteRequest, background_tasks: BackgroundTasks):
    if request.agent_type not in VALID_AGENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid agent type: {request.agent_type}")

    # P0: Pre-execution budget check
    org_id = (request.input_data or {}).get("organization", {}).get("id") or \
              (request.input_data or {}).get("organizationId")
    if org_id:
        try:
            await budget_enforcer.check_budget(org_id)
        except BudgetExceeded as exc:
            raise HTTPException(status_code=429, detail=str(exc))

    if request.execution_id:
        execution_id = request.execution_id
    else:
        execution_id = await execution_store.create(
            agent_type=request.agent_type,
            input_data=request.input_data,
            repository_id=request.repository_id,
        )

    background_tasks.add_task(
        _execute_agent,
        execution_id,
        request.agent_type,
        request.input_data,
        request.repository_id,
    )

    return AgentExecuteResponse(
        execution_id=execution_id,
        status="PENDING",
        message=f"Agent '{request.agent_type}' execution queued",
    )


# ─── P1: Manual Timing Override ──────────────────────────────────────────────

class TimingOverrideRequest(BaseModel):
    entity_type: str          # "value_stream_step" | "functionality"
    entity_id: str
    field: str                # e.g. "process_time_hrs"
    new_value: float
    override_note: Optional[str] = None
    overridden_by: str        # user ID


@router.post("/timing-override")
async def apply_timing_override(req: TimingOverrideRequest):
    """
    Apply a manual timing override to a ValueStreamStep or Functionality.
    Writes the new value to the DB and records an audit entry in timing_overrides.
    """
    from app.core.database import db_pool

    # Validate entity_type and field
    allowed_step_fields = {
        "process_time_hrs", "wait_time_hrs", "lead_time_hrs", "flow_efficiency",
        "target_process_time_hrs", "target_wait_time_hrs",
    }
    allowed_func_fields = {
        "estimated_cycle_time_min", "estimated_wait_time_min",
    }

    if req.entity_type == "value_stream_step":
        if req.field not in allowed_step_fields:
            raise HTTPException(400, f"Invalid field '{req.field}' for value_stream_step")
        table = "value_stream_steps"
        col = req.field  # already snake_case
    elif req.entity_type == "functionality":
        if req.field not in allowed_func_fields:
            raise HTTPException(400, f"Invalid field '{req.field}' for functionality")
        table = "functionalities"
        col = req.field
    else:
        raise HTTPException(400, f"Unknown entity_type: {req.entity_type}")

    # Fetch previous value
    prev_row = await db_pool.fetchrow(
        f'SELECT "{col}" FROM "{table}" WHERE id = $1', req.entity_id
    )
    if not prev_row:
        raise HTTPException(404, f"{req.entity_type} {req.entity_id} not found")

    previous_value = prev_row[col]

    # Apply the update with timing_source = "manual_override" and confidence = 1.0
    extra_cols = ""
    if req.field in ("process_time_hrs", "wait_time_hrs", "lead_time_hrs",
                     "estimated_cycle_time_min", "estimated_wait_time_min"):
        extra_cols = ', timing_source = \'manual_override\', timing_confidence = 1.0'

    await db_pool.execute(
        f'UPDATE "{table}" SET "{col}" = $1{extra_cols}, updated_at = NOW() WHERE id = $2',
        req.new_value,
        req.entity_id,
    )

    # Audit trail
    await db_pool.execute(
        """
        INSERT INTO timing_overrides
            (id, entity_type, entity_id, field, previous_value, new_value,
             override_note, overridden_by, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
        """,
        str(uuid.uuid4()),
        req.entity_type,
        req.entity_id,
        req.field,
        previous_value,
        req.new_value,
        req.override_note,
        req.overridden_by,
    )

    return {
        "status": "ok",
        "entity_type": req.entity_type,
        "entity_id": req.entity_id,
        "field": req.field,
        "previous_value": previous_value,
        "new_value": req.new_value,
    }


@router.get("/status/{execution_id}", response_model=AgentStatusResponse)
async def get_agent_status(execution_id: str):
    status = await execution_store.get_status(execution_id)
    if not status:
        raise HTTPException(status_code=404, detail="Execution not found")
    return AgentStatusResponse(
        execution_id=status["id"],
        agent_type=status["agent_type"],
        status=status["status"],
        started_at=status.get("started_at"),
        completed_at=status.get("completed_at"),
        error_message=status.get("error_message"),
    )


@router.get("/results/{execution_id}", response_model=AgentResultsResponse)
async def get_agent_results(execution_id: str):
    results = await execution_store.get_results(execution_id)
    if not results:
        raise HTTPException(status_code=404, detail="Execution not found")
    return AgentResultsResponse(
        execution_id=results["id"],
        agent_type=results["agent_type"],
        status=results["status"],
        output=results.get("output"),
        error_message=results.get("error_message"),
    )
