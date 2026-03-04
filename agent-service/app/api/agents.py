import asyncio
import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException

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


async def _execute_agent(execution_id: str, agent_type: str, input_data: dict, repository_id: str | None = None):
    channel = f"execution:{execution_id}"

    # Small delay to ensure the INSERT has committed before we UPDATE
    await asyncio.sleep(0.1)

    # Inject repository_id so agents can reference the pre-created repo record
    if repository_id:
        input_data = {**input_data, "repository_id": repository_id}

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


@router.post("/execute", response_model=AgentExecuteResponse, status_code=202)
async def execute_agent(request: AgentExecuteRequest, background_tasks: BackgroundTasks):
    if request.agent_type not in VALID_AGENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid agent type: {request.agent_type}")

    if request.execution_id:
        # Caller (Next.js) already created the DB record — reuse that ID
        execution_id = request.execution_id
    else:
        execution_id = await execution_store.create(
            agent_type=request.agent_type,
            input_data=request.input_data,
            repository_id=request.repository_id,
        )

    background_tasks.add_task(_execute_agent, execution_id, request.agent_type, request.input_data, request.repository_id)

    return AgentExecuteResponse(
        execution_id=execution_id,
        status="PENDING",
        message=f"Agent '{request.agent_type}' execution queued",
    )


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
