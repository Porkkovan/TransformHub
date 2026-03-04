import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from langgraph.graph import StateGraph

from app.agents.base import AgentState, BaseAgent
from app.core.crypto import compute_payload_hash
from app.core.database import db_pool
from app.agents.org_context import get_org_context, format_context_section, org_description
from app.services.claude_client import claude_client

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Node functions
# ---------------------------------------------------------------------------


async def load_product_context(state: AgentState) -> dict[str, Any]:
    """Load digital products with current/future state, risk assessments, VSM metrics."""
    input_data = state["input_data"]
    repository_id = input_data.get("repository_id")
    org_id = (input_data.get("organization") or {}).get("id")

    try:
        if repository_id:
            products = await db_pool.fetch(
                """
                SELECT dp.id, dp.name, dp.description, dp.current_state, dp.future_state,
                       dc.name AS capability_name
                FROM digital_products dp
                LEFT JOIN digital_capabilities dc ON dc.digital_product_id = dp.id
                WHERE dp.repository_id = $1
                """,
                repository_id,
            )
        elif org_id:
            products = await db_pool.fetch(
                """
                SELECT dp.id, dp.name, dp.description, dp.current_state, dp.future_state,
                       dc.name AS capability_name
                FROM digital_products dp
                LEFT JOIN digital_capabilities dc ON dc.digital_product_id = dp.id
                JOIN repositories r ON r.id = dp.repository_id
                WHERE r.organization_id = $1
                """,
                org_id,
            )
        else:
            products = await db_pool.fetch(
                """
                SELECT dp.id, dp.name, dp.description, dp.current_state, dp.future_state,
                       dc.name AS capability_name
                FROM digital_products dp
                LEFT JOIN digital_capabilities dc ON dc.digital_product_id = dp.id
                """
            )

        risk_assessments = await db_pool.fetch(
            "SELECT id, entity_type, entity_id, risk_category, risk_score, severity, transition_blocked FROM risk_assessments"
        )

        vsm_metrics = await db_pool.fetch(
            "SELECT id, digital_capability_id, process_time, lead_time, wait_time, flow_efficiency FROM vsm_metrics"
        )

        compliance_mappings = await db_pool.fetch(
            "SELECT id, framework, entity_type, entity_id, status FROM compliance_mappings"
        )

        product_context = {
            "repository_id": repository_id,
            "products": [dict(r) for r in products],
            "risk_assessments": [dict(r) for r in risk_assessments],
            "vsm_metrics": [dict(r) for r in vsm_metrics],
            "compliance_mappings": [dict(r) for r in compliance_mappings],
        }

        logger.info(
            "Loaded product context: %d products, %d risk assessments, %d VSM metrics",
            len(products),
            len(risk_assessments),
            len(vsm_metrics),
        )
    except Exception as exc:
        logger.error("load_product_context failed: %s", exc)
        product_context = {
            "repository_id": repository_id,
            "products": [],
            "risk_assessments": [],
            "vsm_metrics": [],
            "compliance_mappings": [],
        }

    return {"product_context": product_context, "repository_id": repository_id}


async def assess_readiness(state: AgentState) -> dict[str, Any]:
    """Score transformation readiness (0-10) per product based on risks, metrics, compliance."""
    org = get_org_context(state["input_data"])
    ctx = format_context_section(state["input_data"])
    product_context = state.get("product_context", {})

    prompt = (
        f"Assess transformation readiness for the following digital products in "
        f"{org_description(org)}:\n\n"
        f"Products:\n{json.dumps(product_context.get('products', []), indent=2, default=str)}\n\n"
        f"Risk Assessments:\n{json.dumps(product_context.get('risk_assessments', []), indent=2, default=str)}\n\n"
        f"VSM Metrics:\n{json.dumps(product_context.get('vsm_metrics', []), indent=2, default=str)}\n\n"
        f"Compliance Status:\n{json.dumps(product_context.get('compliance_mappings', []), indent=2, default=str)}\n\n"
        f"{ctx}"
        f"Score each product's transformation readiness on a 0-10 scale considering:\n"
        f"- Risk exposure (lower risk = higher readiness)\n"
        f"- Process maturity (higher flow efficiency = higher readiness)\n"
        f"- Compliance status (more compliant = higher readiness)\n"
        f"- Current vs future state gap (larger gap = lower readiness)\n\n"
        f"Return a JSON array of readiness scores, each with:\n"
        f"product_name, product_id, "
        f"readiness_score (0-10 float), "
        f"risk_factor (0-10), process_maturity_factor (0-10), "
        f"compliance_factor (0-10), gap_factor (0-10), "
        f"key_strengths (list of strings), key_risks (list of strings), "
        f"readiness_level (NOT_READY | PARTIALLY_READY | READY | HIGHLY_READY)."
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=8192)
        readiness_scores = json.loads(raw)
        if not isinstance(readiness_scores, list):
            readiness_scores = readiness_scores.get("readiness_scores", readiness_scores.get("scores", []))
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("assess_readiness failed: %s", exc)
        readiness_scores = []

    return {"readiness_scores": readiness_scores}


async def design_transformation_plan(state: AgentState) -> dict[str, Any]:
    """Create step-by-step transformation plan for each product."""
    org = get_org_context(state["input_data"])
    product_context = state.get("product_context", {})
    readiness_scores = state.get("readiness_scores", [])

    prompt = (
        f"Create a detailed transformation plan for the following digital products "
        f"in {org_description(org)}:\n\n"
        f"Products:\n{json.dumps(product_context.get('products', []), indent=2, default=str)}\n\n"
        f"Readiness Scores:\n{json.dumps(readiness_scores, indent=2)}\n\n"
        f"For each product, create a step-by-step transformation plan including:\n"
        f"- Pre-transformation prerequisites\n"
        f"- Migration steps (ordered)\n"
        f"- Testing and validation checkpoints\n"
        f"- Rollback procedures\n"
        f"- Success criteria\n\n"
        f"Return a JSON array of transformation plans, each with:\n"
        f"product_name, product_id, "
        f"prerequisites (list of strings), "
        f"steps (list of {{step_number, name, description, duration_weeks, dependencies}}), "
        f"testing_checkpoints (list of strings), "
        f"rollback_procedure (string), "
        f"success_criteria (list of strings), "
        f"estimated_total_weeks (int)."
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=8192)
        transformation_plan = json.loads(raw)
        if not isinstance(transformation_plan, list):
            transformation_plan = transformation_plan.get("transformation_plans", transformation_plan.get("plans", []))
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("design_transformation_plan failed: %s", exc)
        transformation_plan = []

    return {"transformation_plan": transformation_plan}


async def evaluate_gate(state: AgentState) -> dict[str, Any]:
    """Check if all readiness scores > 5.0 and no CRITICAL risks block transition."""
    readiness_scores = state.get("readiness_scores", [])
    product_context = state.get("product_context", {})

    all_ready = True
    blocked_products = []
    critical_blockers = []

    for score_entry in readiness_scores:
        readiness = score_entry.get("readiness_score", 0.0)
        if readiness <= 5.0:
            all_ready = False
            blocked_products.append({
                "product_name": score_entry.get("product_name", "Unknown"),
                "readiness_score": readiness,
                "reason": "Readiness score below threshold (5.0)",
            })

    # Check for CRITICAL risk assessments that block transition
    for risk in product_context.get("risk_assessments", []):
        if risk.get("severity") == "CRITICAL" and risk.get("transition_blocked"):
            all_ready = False
            critical_blockers.append({
                "entity_id": risk.get("entity_id"),
                "risk_category": risk.get("risk_category"),
                "risk_score": risk.get("risk_score"),
            })

    gate_evaluation = {
        "all_ready": all_ready,
        "blocked_products": blocked_products,
        "critical_blockers": critical_blockers,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
    }

    return {"gate_evaluation": gate_evaluation}


def should_approve_transformation(state: AgentState) -> str:
    """Conditional edge: returns 'approve' if gate passes, else 'block'."""
    gate = state.get("gate_evaluation", {})
    if gate.get("all_ready", False):
        return "approve"
    return "block"


async def approve_transformation(state: AgentState) -> dict[str, Any]:
    """Mark products as approved for transformation."""
    readiness_scores = state.get("readiness_scores", [])

    approved_products = []
    for score_entry in readiness_scores:
        approved_products.append({
            "product_name": score_entry.get("product_name"),
            "product_id": score_entry.get("product_id"),
            "readiness_score": score_entry.get("readiness_score"),
            "approved_at": datetime.now(timezone.utc).isoformat(),
        })

    return {
        "transformation_approved": True,
        "blockers": [],
    }


async def flag_blockers(state: AgentState) -> dict[str, Any]:
    """Identify specific blockers preventing transformation."""
    gate_evaluation = state.get("gate_evaluation", {})
    readiness_scores = state.get("readiness_scores", [])

    prompt = (
        f"Analyze the following transformation gate evaluation results and identify "
        f"specific blockers with remediation steps:\n\n"
        f"Gate Evaluation:\n{json.dumps(gate_evaluation, indent=2, default=str)}\n\n"
        f"Readiness Scores:\n{json.dumps(readiness_scores, indent=2)}\n\n"
        f"For each blocker, provide:\n"
        f"- Root cause analysis\n"
        f"- Specific remediation steps\n"
        f"- Estimated time to remediate\n"
        f"- Impact if not addressed\n\n"
        f"Return a JSON array of blockers, each with:\n"
        f"product_name, blocker_type (READINESS | RISK | COMPLIANCE), "
        f"description, root_cause, remediation_steps (list of strings), "
        f"estimated_remediation_weeks (int), impact_if_unresolved (string)."
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=4096)
        blockers = json.loads(raw)
        if not isinstance(blockers, list):
            blockers = blockers.get("blockers", [])
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("flag_blockers failed: %s", exc)
        blockers = []

    return {
        "transformation_approved": False,
        "blockers": blockers,
    }


async def persist_transformation(state: AgentState) -> dict[str, Any]:
    """Update product future states, write audit log."""
    repository_id = state.get("repository_id")
    transformation_plan = state.get("transformation_plan", [])
    transformation_approved = state.get("transformation_approved", False)
    readiness_scores = state.get("readiness_scores", [])
    blockers = state.get("blockers", [])

    try:
        # Update product future_state with transformation plan summary
        for plan in transformation_plan:
            product_id = plan.get("product_id")
            if not product_id:
                continue
            future_state = (
                f"Transformation: {len(plan.get('steps', []))} steps, "
                f"~{plan.get('estimated_total_weeks', 0)} weeks. "
                f"Approved: {transformation_approved}"
            )
            await db_pool.execute(
                """
                UPDATE digital_products
                SET future_state = $1, updated_at = NOW()
                WHERE id = $2
                """,
                future_state,
                product_id,
            )

        # Build audit chain
        previous_hash: str | None = None

        readiness_payload = {
            "action": "READINESS_ASSESSED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "products_assessed": len(readiness_scores),
            "transformation_approved": transformation_approved,
        }
        readiness_hash = compute_payload_hash(readiness_payload, previous_hash)
        audit_id_1 = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO audit_logs (
                id, action, entity_type, entity_id, actor,
                payload, payload_hash, previous_hash, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
            """,
            audit_id_1,
            "READINESS_ASSESSED",
            "AgentExecution",
            repository_id or audit_id_1,
            "product-transformation-agent",
            json.dumps(readiness_payload, default=str),
            readiness_hash,
            previous_hash,
        )
        previous_hash = readiness_hash

        gate_payload = {
            "action": "TRANSFORMATION_GATE_EVALUATED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "approved": transformation_approved,
            "blockers_count": len(blockers),
        }
        gate_hash = compute_payload_hash(gate_payload, previous_hash)
        audit_id_2 = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO audit_logs (
                id, action, entity_type, entity_id, actor,
                payload, payload_hash, previous_hash, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
            """,
            audit_id_2,
            "TRANSFORMATION_GATE_EVALUATED",
            "AgentExecution",
            repository_id or audit_id_2,
            "product-transformation-agent",
            json.dumps(gate_payload, default=str),
            gate_hash,
            previous_hash,
        )

        logger.info(
            "Product transformation results persisted: %d plans, approved=%s, %d blockers",
            len(transformation_plan),
            transformation_approved,
            len(blockers),
        )
    except Exception as exc:
        logger.error("persist_transformation failed: %s", exc)
        return {"error": str(exc)}

    return {
        "results": {
            "repository_id": repository_id,
            "products_planned": len(transformation_plan),
            "transformation_approved": transformation_approved,
            "blockers_count": len(blockers),
            "readiness_scores_count": len(readiness_scores),
        }
    }


# ---------------------------------------------------------------------------
# Build the LangGraph StateGraph
# ---------------------------------------------------------------------------

graph = StateGraph(AgentState)

graph.add_node("load_product_context", load_product_context)
graph.add_node("assess_readiness", assess_readiness)
graph.add_node("design_transformation_plan", design_transformation_plan)
graph.add_node("evaluate_gate", evaluate_gate)
graph.add_node("approve_transformation", approve_transformation)
graph.add_node("flag_blockers", flag_blockers)
graph.add_node("persist_transformation", persist_transformation)

graph.set_entry_point("load_product_context")
graph.add_edge("load_product_context", "assess_readiness")
graph.add_edge("assess_readiness", "design_transformation_plan")
graph.add_edge("design_transformation_plan", "evaluate_gate")

graph.add_conditional_edges(
    "evaluate_gate",
    should_approve_transformation,
    {
        "approve": "approve_transformation",
        "block": "flag_blockers",
    },
)

graph.add_edge("approve_transformation", "persist_transformation")
graph.add_edge("flag_blockers", "persist_transformation")
graph.set_finish_point("persist_transformation")

compiled_graph = graph.compile()


# ---------------------------------------------------------------------------
# Agent class
# ---------------------------------------------------------------------------


class ProductTransformationAgent(BaseAgent):
    def get_name(self) -> str:
        return "product_transformation"

    async def run(self, input_data: dict[str, Any]) -> dict[str, Any]:
        logger.info("ProductTransformationAgent starting with input keys: %s", list(input_data.keys()))
        initial_state: AgentState = {"input_data": input_data}

        try:
            final_state = await compiled_graph.ainvoke(initial_state)
        except Exception as exc:
            logger.error("ProductTransformationAgent execution failed: %s", exc)
            return {"error": str(exc)}

        return final_state.get("results", {"error": final_state.get("error", "Unknown error")})
