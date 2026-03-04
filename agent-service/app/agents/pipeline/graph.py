"""
Pipeline meta-agent that executes the full TransformHub agent pipeline in DAG
order.  Each layer's agents are run in parallel via ``asyncio.gather`` and
per-agent status is tracked in the database and published to the event bus.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from app.agents.orchestrator import run_agent
from app.agents.pipeline.dag import ParallelGroup, default_pipeline
from app.core.database import db_pool
from app.services.event_bus import event_bus

logger = logging.getLogger(__name__)


class AgentStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


# ---------------------------------------------------------------------------
# Per-agent status tracking
# ---------------------------------------------------------------------------

async def _update_agent_status(
    pipeline_execution_id: str,
    agent_type: str,
    status: AgentStatus,
    output: dict[str, Any] | None = None,
    error_message: str | None = None,
) -> None:
    """Persist per-agent status inside the ``pipeline_agent_statuses`` table."""
    try:
        await db_pool.execute(
            """
            INSERT INTO pipeline_agent_statuses
                (id, pipeline_execution_id, agent_type, status, output, error_message, updated_at)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())
            ON CONFLICT (pipeline_execution_id, agent_type) DO UPDATE
                SET status = $4,
                    output = COALESCE($5::jsonb, pipeline_agent_statuses.output),
                    error_message = $6,
                    updated_at = NOW()
            """,
            str(uuid.uuid4()),
            pipeline_execution_id,
            agent_type,
            status.value,
            json.dumps(output) if output else None,
            error_message,
        )
    except Exception as exc:
        logger.error(
            "Failed to update agent status for %s in pipeline %s: %s",
            agent_type,
            pipeline_execution_id,
            exc,
        )


async def _publish_agent_event(
    pipeline_execution_id: str,
    agent_type: str,
    status: AgentStatus,
    extra: dict[str, Any] | None = None,
) -> None:
    """Broadcast per-agent lifecycle events on the pipeline event channel."""
    channel = f"pipeline:{pipeline_execution_id}"
    payload: dict[str, Any] = {
        "type": "agent_status",
        "pipeline_execution_id": pipeline_execution_id,
        "agent_type": agent_type,
        "status": status.value,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if extra:
        payload.update(extra)
    await event_bus.publish(channel, payload)


# ---------------------------------------------------------------------------
# Single-agent runner (with status tracking)
# ---------------------------------------------------------------------------

async def _run_single_agent(
    pipeline_execution_id: str,
    agent_type: str,
    input_data: dict[str, Any],
    accumulated_results: dict[str, Any],
) -> tuple[str, dict[str, Any]]:
    """Execute one agent, track its status, and return ``(agent_type, result)``."""

    await _update_agent_status(pipeline_execution_id, agent_type, AgentStatus.RUNNING)
    await _publish_agent_event(pipeline_execution_id, agent_type, AgentStatus.RUNNING)

    # Merge accumulated results from prior layers into the agent's input
    enriched_input = {**input_data, "pipeline_context": accumulated_results}

    try:
        result = await run_agent(agent_type, enriched_input)

        if "error" in result:
            await _update_agent_status(
                pipeline_execution_id,
                agent_type,
                AgentStatus.FAILED,
                error_message=result["error"],
            )
            await _publish_agent_event(
                pipeline_execution_id,
                agent_type,
                AgentStatus.FAILED,
                {"error": result["error"]},
            )
        else:
            await _update_agent_status(
                pipeline_execution_id,
                agent_type,
                AgentStatus.COMPLETED,
                output=result,
            )
            await _publish_agent_event(
                pipeline_execution_id,
                agent_type,
                AgentStatus.COMPLETED,
            )

        return agent_type, result

    except Exception as exc:
        error_msg = str(exc)
        logger.error(
            "Agent '%s' raised exception in pipeline %s: %s",
            agent_type,
            pipeline_execution_id,
            error_msg,
            exc_info=True,
        )
        await _update_agent_status(
            pipeline_execution_id,
            agent_type,
            AgentStatus.FAILED,
            error_message=error_msg,
        )
        await _publish_agent_event(
            pipeline_execution_id,
            agent_type,
            AgentStatus.FAILED,
            {"error": error_msg},
        )
        return agent_type, {"error": error_msg}


# ---------------------------------------------------------------------------
# Pipeline executor
# ---------------------------------------------------------------------------

async def execute_pipeline(
    pipeline_execution_id: str,
    input_data: dict[str, Any],
    *,
    halt_on_failure: bool = True,
) -> dict[str, Any]:
    """
    Run the full pipeline in DAG topological / parallel-group order.

    Parameters
    ----------
    pipeline_execution_id:
        Pre-allocated ID for this pipeline run (stored in ``pipeline_executions``).
    input_data:
        Shared input data for every agent (e.g. ``repository_url``).
    halt_on_failure:
        If ``True``, abort the pipeline if any agent in a layer fails.

    Returns
    -------
    dict
        Mapping of ``agent_type`` -> agent result dict.
    """
    groups: list[ParallelGroup] = default_pipeline.parallel_groups()
    accumulated: dict[str, Any] = {}
    channel = f"pipeline:{pipeline_execution_id}"

    logger.info(
        "Starting pipeline %s with %d layers: %s",
        pipeline_execution_id,
        len(groups),
        [g.agents for g in groups],
    )

    # Mark all agents as PENDING up front
    for group in groups:
        for agent_type in group.agents:
            await _update_agent_status(
                pipeline_execution_id, agent_type, AgentStatus.PENDING
            )

    await event_bus.publish(channel, {
        "type": "pipeline_started",
        "pipeline_execution_id": pipeline_execution_id,
        "layers": [g.agents for g in groups],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    failed_agents: list[str] = []

    for layer_idx, group in enumerate(groups):
        logger.info(
            "Pipeline %s: executing layer %d — %s",
            pipeline_execution_id,
            layer_idx,
            group.agents,
        )

        await event_bus.publish(channel, {
            "type": "layer_started",
            "layer_index": layer_idx,
            "agents": group.agents,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        # Skip agents whose dependencies failed (if halt_on_failure is False)
        agents_to_run: list[str] = []
        for agent_type in group.agents:
            deps = default_pipeline.get_dependencies(agent_type)
            if deps & set(failed_agents):
                logger.warning(
                    "Skipping agent '%s' — dependency failed: %s",
                    agent_type,
                    deps & set(failed_agents),
                )
                await _update_agent_status(
                    pipeline_execution_id, agent_type, AgentStatus.SKIPPED
                )
                await _publish_agent_event(
                    pipeline_execution_id, agent_type, AgentStatus.SKIPPED
                )
                continue
            agents_to_run.append(agent_type)

        # Execute all agents in this layer concurrently
        tasks = [
            _run_single_agent(pipeline_execution_id, agent_type, input_data, accumulated)
            for agent_type in agents_to_run
        ]
        results = await asyncio.gather(*tasks, return_exceptions=False)

        layer_failed = False
        for agent_type, result in results:
            accumulated[agent_type] = result
            if "error" in result:
                failed_agents.append(agent_type)
                layer_failed = True

        await event_bus.publish(channel, {
            "type": "layer_completed",
            "layer_index": layer_idx,
            "agents": group.agents,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        if layer_failed and halt_on_failure:
            logger.warning(
                "Pipeline %s halted at layer %d due to agent failures: %s",
                pipeline_execution_id,
                layer_idx,
                [a for a in group.agents if a in failed_agents],
            )
            # Mark remaining agents as SKIPPED
            for remaining_group in groups[layer_idx + 1:]:
                for remaining_agent in remaining_group.agents:
                    await _update_agent_status(
                        pipeline_execution_id,
                        remaining_agent,
                        AgentStatus.SKIPPED,
                    )
            break

    pipeline_status = "COMPLETED" if not failed_agents else "FAILED"

    await event_bus.publish(channel, {
        "type": "pipeline_completed",
        "pipeline_execution_id": pipeline_execution_id,
        "status": pipeline_status,
        "failed_agents": failed_agents,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    await event_bus.close_channel(channel)

    logger.info(
        "Pipeline %s finished with status %s. Results: %d agents.",
        pipeline_execution_id,
        pipeline_status,
        len(accumulated),
    )

    return accumulated
