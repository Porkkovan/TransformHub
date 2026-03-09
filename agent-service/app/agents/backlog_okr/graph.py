import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from langgraph.graph import StateGraph

from app.agents.base import AgentState, BaseAgent
from app.core.crypto import compute_payload_hash
from app.core.database import db_pool
from app.agents.org_context import get_org_context, format_context_section, format_personas, org_description
from app.services.claude_client import claude_client

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Node functions
# ---------------------------------------------------------------------------


async def load_transformation_context(state: AgentState) -> dict[str, Any]:
    """Load digital products, capabilities, VSM metrics, risk assessments."""
    input_data = state["input_data"]
    repository_id = input_data.get("repository_id")

    try:
        if repository_id:
            capabilities = await db_pool.fetch(
                """
                SELECT dc.id, dc.name, dc.description, dc.category
                FROM digital_capabilities dc
                JOIN digital_products dp ON dp.id = dc.digital_product_id
                WHERE dp.repository_id = $1
                """,
                repository_id,
            )
            products = await db_pool.fetch(
                """
                SELECT dp.id, dp.name, dp.description,
                       dp.current_state, dp.future_state
                FROM digital_products dp
                WHERE dp.repository_id = $1
                """,
                repository_id,
            )
        elif org_id := (input_data.get("organization") or {}).get("id"):
            capabilities = await db_pool.fetch(
                """
                SELECT dc.id, dc.name, dc.description, dc.category
                FROM digital_capabilities dc
                JOIN digital_products dp ON dp.id = dc.digital_product_id
                JOIN repositories r ON r.id = dp.repository_id
                WHERE r.organization_id = $1
                """,
                org_id,
            )
            products = await db_pool.fetch(
                """
                SELECT dp.id, dp.name, dp.description,
                       dp.current_state, dp.future_state
                FROM digital_products dp
                JOIN repositories r ON r.id = dp.repository_id
                WHERE r.organization_id = $1
                """,
                org_id,
            )
        else:
            capabilities = await db_pool.fetch(
                "SELECT id, name, description, category FROM digital_capabilities"
            )
            products = await db_pool.fetch(
                "SELECT id, name, description, current_state, future_state FROM digital_products"
            )

        vsm_metrics = await db_pool.fetch(
            "SELECT id, digital_capability_id, process_time, lead_time, wait_time, flow_efficiency FROM vsm_metrics"
        )

        risk_assessments = await db_pool.fetch(
            "SELECT id, entity_type, entity_id, risk_category, risk_score, severity, description FROM risk_assessments"
        )

        transformation_context = {
            "repository_id": repository_id,
            "capabilities": [dict(r) for r in capabilities],
            "products": [dict(r) for r in products],
            "vsm_metrics": [dict(r) for r in vsm_metrics],
            "risk_assessments": [dict(r) for r in risk_assessments],
        }

        logger.info(
            "Loaded transformation context: %d capabilities, %d products, %d metrics, %d risks",
            len(capabilities),
            len(products),
            len(vsm_metrics),
            len(risk_assessments),
        )
    except Exception as exc:
        logger.error("load_transformation_context failed: %s", exc)
        transformation_context = {
            "repository_id": repository_id,
            "capabilities": [],
            "products": [],
            "vsm_metrics": [],
            "risk_assessments": [],
        }

    return {"transformation_context": transformation_context, "repository_id": repository_id}


async def generate_okrs(state: AgentState) -> dict[str, Any]:
    """Generate quarterly OKRs aligned with transformation goals."""
    org = get_org_context(state["input_data"])
    ctx = format_context_section(state["input_data"], agent_type="backlog_okr")
    transformation_context = state.get("transformation_context", {})

    prompt = (
        f"Generate quarterly OKRs (Objectives and Key Results) for "
        f"{org_description(org)} digital transformation:\n\n"
        f"Digital Capabilities:\n{json.dumps(transformation_context.get('capabilities', []), indent=2)}\n\n"
        f"Products with current/future state:\n{json.dumps(transformation_context.get('products', []), indent=2, default=str)}\n\n"
        f"VSM Metrics:\n{json.dumps(transformation_context.get('vsm_metrics', []), indent=2, default=str)}\n\n"
        f"Risk Assessments:\n{json.dumps(transformation_context.get('risk_assessments', []), indent=2, default=str)}\n\n"
        f"{ctx}"
        f"Generate OKRs for Q1-Q4 covering:\n"
        f"- Platform modernization objectives\n"
        f"- Client experience improvement objectives\n"
        f"- Operational efficiency objectives\n"
        f"- Risk reduction objectives\n\n"
        f"Each key result should be measurable and time-bound.\n\n"
        f"Return a JSON array of OKRs, each with:\n"
        f"quarter (Q1 | Q2 | Q3 | Q4), "
        f"objective (string), "
        f"key_results (list of {{description, metric, target_value, current_value, unit}}), "
        f"related_capabilities (list of capability names), "
        f"priority (P0 | P1 | P2)."
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=8192)
        okrs = json.loads(raw)
        if not isinstance(okrs, list):
            okrs = okrs.get("okrs", okrs.get("objectives", []))
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("generate_okrs failed: %s", exc)
        okrs = []

    return {"okrs": okrs}


async def generate_backlog(state: AgentState) -> dict[str, Any]:
    """Create epics and user stories from each transformation plan."""
    org = get_org_context(state["input_data"])
    transformation_context = state.get("transformation_context", {})
    okrs = state.get("okrs", [])

    prompt = (
        f"Generate a product backlog (epics and user stories) for "
        f"{org_description(org)} transformation:\n\n"
        f"OKRs:\n{json.dumps(okrs, indent=2)}\n\n"
        f"Products:\n{json.dumps(transformation_context.get('products', []), indent=2, default=str)}\n\n"
        f"Capabilities:\n{json.dumps(transformation_context.get('capabilities', []), indent=2)}\n\n"
        f"Create epics for each major transformation initiative, with user stories "
        f"following the format: As a [persona], I want [feature], so that [benefit].\n\n"
        f"Return a JSON array of backlog items, each with:\n"
        f"type (epic | story), "
        f"title (string), "
        f"description (string), "
        f"acceptance_criteria (list of strings), "
        f"parent_epic (string, null for epics), "
        f"related_okr_objective (string), "
        f"related_capability (string), "
        f"story_points (int, 1|2|3|5|8|13), "
        f"persona (use personas from org context: {format_personas(org['personas'])})."
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=8192)
        backlog_items = json.loads(raw)
        if not isinstance(backlog_items, list):
            backlog_items = backlog_items.get("backlog_items", backlog_items.get("backlog", []))
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("generate_backlog failed: %s", exc)
        backlog_items = []

    return {"backlog_items": backlog_items}


async def prioritize_backlog(state: AgentState) -> dict[str, Any]:
    """Prioritize using WSJF (Weighted Shortest Job First) scoring."""
    org = get_org_context(state["input_data"])
    backlog_items = state.get("backlog_items", [])
    okrs = state.get("okrs", [])

    prompt = (
        f"Prioritize the following backlog items using WSJF (Weighted Shortest Job First) "
        f"methodology:\n\n"
        f"Backlog Items:\n{json.dumps(backlog_items, indent=2)}\n\n"
        f"OKRs:\n{json.dumps(okrs, indent=2)}\n\n"
        f"Calculate WSJF score for each item:\n"
        f"WSJF = Cost of Delay / Job Duration\n"
        f"Cost of Delay = Business Value + Time Criticality + Risk Reduction\n\n"
        f"Score each factor on a Fibonacci scale (1, 2, 3, 5, 8, 13).\n\n"
        f"Return a JSON array of prioritized items, each with:\n"
        f"title, type, "
        f"business_value (1-13), time_criticality (1-13), "
        f"risk_reduction (1-13), job_duration (1-13), "
        f"cost_of_delay (int), wsjf_score (float), "
        f"priority_rank (int, 1=highest), "
        f"recommended_sprint (string), "
        f"dependencies (list of item titles)."
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=8192)
        prioritized = json.loads(raw)
        if not isinstance(prioritized, list):
            prioritized = prioritized.get("prioritized_backlog", prioritized.get("items", []))

        # Sort by WSJF score descending
        prioritized.sort(key=lambda x: x.get("wsjf_score", 0), reverse=True)

        # Reassign ranks after sorting
        for i, item in enumerate(prioritized):
            item["priority_rank"] = i + 1
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("prioritize_backlog failed: %s", exc)
        prioritized = []

    return {"prioritized_backlog": prioritized}


async def persist_backlog(state: AgentState) -> dict[str, Any]:
    """Write audit log entries for generated backlog."""
    repository_id = state.get("repository_id")
    okrs = state.get("okrs", [])
    backlog_items = state.get("backlog_items", [])
    prioritized_backlog = state.get("prioritized_backlog", [])

    try:
        # Build audit chain
        previous_hash: str | None = None

        okr_payload = {
            "action": "OKRS_GENERATED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "okrs_count": len(okrs),
            "quarters_covered": list({o.get("quarter", "") for o in okrs}),
        }
        okr_hash = compute_payload_hash(okr_payload, previous_hash)
        audit_id_1 = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO audit_logs (
                id, action, entity_type, entity_id, actor,
                payload, payload_hash, previous_hash, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
            """,
            audit_id_1,
            "OKRS_GENERATED",
            "AgentExecution",
            repository_id or audit_id_1,
            "backlog-okr-agent",
            json.dumps(okr_payload, default=str),
            okr_hash,
            previous_hash,
        )
        previous_hash = okr_hash

        backlog_payload = {
            "action": "BACKLOG_GENERATED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "total_items": len(backlog_items),
            "epics_count": len([i for i in backlog_items if i.get("type") == "epic"]),
            "stories_count": len([i for i in backlog_items if i.get("type") == "story"]),
        }
        backlog_hash = compute_payload_hash(backlog_payload, previous_hash)
        audit_id_2 = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO audit_logs (
                id, action, entity_type, entity_id, actor,
                payload, payload_hash, previous_hash, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
            """,
            audit_id_2,
            "BACKLOG_GENERATED",
            "AgentExecution",
            repository_id or audit_id_2,
            "backlog-okr-agent",
            json.dumps(backlog_payload, default=str),
            backlog_hash,
            previous_hash,
        )
        previous_hash = backlog_hash

        prioritize_payload = {
            "action": "BACKLOG_PRIORITIZED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "prioritized_count": len(prioritized_backlog),
            "top_3": [
                {"title": i.get("title", ""), "wsjf_score": i.get("wsjf_score", 0)}
                for i in prioritized_backlog[:3]
            ],
        }
        prioritize_hash = compute_payload_hash(prioritize_payload, previous_hash)
        audit_id_3 = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO audit_logs (
                id, action, entity_type, entity_id, actor,
                payload, payload_hash, previous_hash, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
            """,
            audit_id_3,
            "BACKLOG_PRIORITIZED",
            "AgentExecution",
            repository_id or audit_id_3,
            "backlog-okr-agent",
            json.dumps(prioritize_payload, default=str),
            prioritize_hash,
            previous_hash,
        )

        logger.info(
            "Backlog/OKR results persisted: %d OKRs, %d backlog items, %d prioritized",
            len(okrs),
            len(backlog_items),
            len(prioritized_backlog),
        )
    except Exception as exc:
        logger.error("persist_backlog failed: %s", exc)
        return {"error": str(exc)}

    return {
        "results": {
            "repository_id": repository_id,
            "okrs_count": len(okrs),
            "backlog_items_count": len(backlog_items),
            "prioritized_backlog_count": len(prioritized_backlog),
        }
    }


# ---------------------------------------------------------------------------
# Build the LangGraph StateGraph
# ---------------------------------------------------------------------------

graph = StateGraph(AgentState)

graph.add_node("load_transformation_context", load_transformation_context)
graph.add_node("generate_okrs", generate_okrs)
graph.add_node("generate_backlog", generate_backlog)
graph.add_node("prioritize_backlog", prioritize_backlog)
graph.add_node("persist_backlog", persist_backlog)

graph.set_entry_point("load_transformation_context")
graph.add_edge("load_transformation_context", "generate_okrs")
graph.add_edge("generate_okrs", "generate_backlog")
graph.add_edge("generate_backlog", "prioritize_backlog")
graph.add_edge("prioritize_backlog", "persist_backlog")
graph.set_finish_point("persist_backlog")

compiled_graph = graph.compile()


# ---------------------------------------------------------------------------
# Agent class
# ---------------------------------------------------------------------------


class BacklogOkrAgent(BaseAgent):
    def get_name(self) -> str:
        return "backlog_okr"

    async def run(self, input_data: dict[str, Any]) -> dict[str, Any]:
        logger.info("BacklogOkrAgent starting with input keys: %s", list(input_data.keys()))
        initial_state: AgentState = {"input_data": input_data}

        try:
            final_state = await compiled_graph.ainvoke(initial_state)
        except Exception as exc:
            logger.error("BacklogOkrAgent execution failed: %s", exc)
            return {"error": str(exc)}

        return final_state.get("results", {"error": final_state.get("error", "Unknown error")})
