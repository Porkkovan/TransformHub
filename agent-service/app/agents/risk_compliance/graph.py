import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from langgraph.graph import StateGraph

from app.agents.base import AgentState, BaseAgent
from app.core.crypto import compute_payload_hash
from app.core.database import db_pool
from app.agents.org_context import get_org_context, format_context_section, format_frameworks, org_description
from app.agents.bm25_retrieval import bm25_rerank_for_agent
from app.services.claude_client import claude_client

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Node functions
# ---------------------------------------------------------------------------


async def load_context(state: AgentState) -> dict[str, Any]:
    """Load capabilities, products, and existing assessments from DB."""
    input_data = state["input_data"]
    repository_id = input_data.get("repository_id")
    org_id = (input_data.get("organization") or {}).get("id")

    try:
        if repository_id:
            capabilities = await db_pool.fetch(
                """
                SELECT dc.id, dc.name, dc.description
                FROM digital_capabilities dc
                JOIN digital_products dp ON dp.id = dc.digital_product_id
                WHERE dp.repository_id = $1
                """,
                repository_id,
            )
            products = await db_pool.fetch(
                """
                SELECT dp.id, dp.name, dp.description, dp.current_state, dp.future_state
                FROM digital_products dp
                WHERE dp.repository_id = $1
                """,
                repository_id,
            )
        elif org_id:
            capabilities = await db_pool.fetch(
                """
                SELECT dc.id, dc.name, dc.description
                FROM digital_capabilities dc
                JOIN digital_products dp ON dp.id = dc.digital_product_id
                JOIN repositories r ON r.id = dp.repository_id
                WHERE r.organization_id = $1
                """,
                org_id,
            )
            products = await db_pool.fetch(
                """
                SELECT dp.id, dp.name, dp.description, dp.current_state, dp.future_state
                FROM digital_products dp
                JOIN repositories r ON r.id = dp.repository_id
                WHERE r.organization_id = $1
                """,
                org_id,
            )
        else:
            capabilities = await db_pool.fetch("SELECT id, name, description FROM digital_capabilities")
            products = await db_pool.fetch("SELECT id, name, description, current_state, future_state FROM digital_products")

        existing_assessments = await db_pool.fetch(
            "SELECT id, entity_type, entity_id, risk_category, risk_score, severity FROM risk_assessments"
        )

        context = {
            "repository_id": repository_id,
            "capabilities": [dict(r) for r in capabilities],
            "products": [dict(r) for r in products],
            "existing_assessments": [dict(r) for r in existing_assessments],
        }

        logger.info(
            "Loaded context: %d capabilities, %d products, %d existing assessments",
            len(capabilities),
            len(products),
            len(existing_assessments),
        )
    except Exception as exc:
        logger.error("load_context failed: %s", exc)
        context = {
            "repository_id": repository_id,
            "capabilities": [],
            "products": [],
            "existing_assessments": [],
        }

    return {"context": context, "repository_id": repository_id}


async def map_regulations(state: AgentState) -> dict[str, Any]:
    """Map entities to FINRA/SEC/GDPR requirements."""
    input_data = bm25_rerank_for_agent(
        state["input_data"],
        "regulatory compliance GDPR FINRA SOX risk assessment data privacy framework requirement",
    )
    state = {**state, "input_data": input_data}
    org = get_org_context(input_data)
    ctx = format_context_section(input_data, agent_type="risk_compliance")
    context = state.get("context", {})

    prompt = (
        f"Map the following {org_description(org)} entities to applicable "
        f"regulatory requirements:\n\n"
        f"Capabilities:\n{json.dumps(context.get('capabilities', []), indent=2)}\n\n"
        f"Products:\n{json.dumps(context.get('products', []), indent=2)}\n\n"
        f"{ctx}"
        f"Consider these regulatory frameworks: {format_frameworks(org['regulatory_frameworks'])}\n\n"
        f"Return a JSON array of compliance mappings, each with:\n"
        f"entity_type (capability | product), entity_name, entity_id (use the exact id from the capabilities/products list above), regulation, "
        f"requirement_id, requirement_description, applicability_rationale, "
        f"compliance_status (COMPLIANT | PARTIAL | NON_COMPLIANT | NEEDS_REVIEW)."
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=8192)
        regulations = json.loads(raw)
        if not isinstance(regulations, list):
            regulations = regulations.get("compliance_mappings", regulations.get("regulations", []))
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("map_regulations failed: %s", exc)
        regulations = []

    return {"regulations": regulations}


async def score_risks(state: AgentState) -> dict[str, Any]:
    """Score risks (0-10) for each entity across risk categories."""
    org = get_org_context(state["input_data"])
    context = state.get("context", {})
    regulations = state.get("regulations", [])

    prompt = (
        f"Score the risks for the following {org_description(org)} entities "
        f"on a scale of 0-10:\n\n"
        f"Capabilities:\n{json.dumps(context.get('capabilities', []), indent=2)}\n\n"
        f"Products:\n{json.dumps(context.get('products', []), indent=2)}\n\n"
        f"Compliance mappings:\n{json.dumps(regulations, indent=2)}\n\n"
        f"Score each entity across these risk categories:\n"
        f"- OPERATIONAL: operational risk from process failures, human errors\n"
        f"- REGULATORY: risk of regulatory violations and penalties\n"
        f"- TECHNOLOGY: technology risk from system failures, cyber threats\n"
        f"- DATA_PRIVACY: risk of data breaches, privacy violations\n\n"
        f"Severity mapping: <3 = LOW, <6 = MEDIUM, <8 = HIGH, >=8 = CRITICAL\n\n"
        f"Return a JSON array of risk scores, each with:\n"
        f"entity_type, entity_name, entity_id, risk_category "
        f"(OPERATIONAL | REGULATORY | TECHNOLOGY | DATA_PRIVACY), "
        f"risk_score (0-10 float), severity (LOW | MEDIUM | HIGH | CRITICAL), "
        f"risk_description, mitigation_recommendation."
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=8192)
        risk_scores = json.loads(raw)
        if not isinstance(risk_scores, list):
            risk_scores = risk_scores.get("risk_scores", [])

        # Enforce severity mapping based on score
        for score_entry in risk_scores:
            rs = score_entry.get("risk_score", 0)
            if rs < 3:
                score_entry["severity"] = "LOW"
            elif rs < 6:
                score_entry["severity"] = "MEDIUM"
            elif rs < 8:
                score_entry["severity"] = "HIGH"
            else:
                score_entry["severity"] = "CRITICAL"
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("score_risks failed: %s", exc)
        risk_scores = []

    return {"risk_scores": risk_scores}


async def evaluate_transition(state: AgentState) -> dict[str, Any]:
    """Evaluate whether the current-to-future state transition should proceed."""
    risk_scores = state.get("risk_scores", [])

    max_risk_score = 0.0
    critical_risks = []

    for entry in risk_scores:
        score = entry.get("risk_score", 0.0)
        if score > max_risk_score:
            max_risk_score = score
        if entry.get("severity") == "CRITICAL":
            critical_risks.append(entry)

    transition_evaluation = {
        "max_risk_score": max_risk_score,
        "critical_risk_count": len(critical_risks),
        "critical_risks": critical_risks,
        "recommendation": "APPROVE" if max_risk_score < 8.0 else "BLOCK",
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
    }

    return {"transition_evaluation": transition_evaluation}


def should_approve_transition(state: AgentState) -> str:
    """Conditional edge: returns 'approve' if max risk score < 8.0, else 'block'."""
    evaluation = state.get("transition_evaluation", {})
    max_score = evaluation.get("max_risk_score", 10.0)
    if max_score < 8.0:
        return "approve"
    return "block"


async def approve_transition(state: AgentState) -> dict[str, Any]:
    """Set approved=True and create approval audit entry."""
    evaluation = state.get("transition_evaluation", {})

    approval_entry = {
        "action": "TRANSITION_APPROVED",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": {
            "max_risk_score": evaluation.get("max_risk_score"),
            "recommendation": "APPROVE",
        },
    }

    existing_entries = list(state.get("audit_entries", []))
    existing_entries.append(approval_entry)

    return {
        "approved": True,
        "audit_entries": existing_entries,
    }


async def create_audit_log(state: AgentState) -> dict[str, Any]:
    """Create SHA-256 chained audit entries using compute_payload_hash."""
    existing_entries = list(state.get("audit_entries", []))
    risk_scores = state.get("risk_scores", [])
    regulations = state.get("regulations", [])
    evaluation = state.get("transition_evaluation", {})
    approved = state.get("approved", False)

    # Build audit chain
    chained_entries: list[dict] = []
    previous_hash: str | None = None

    # Audit entry for regulation mapping
    reg_payload = {
        "action": "REGULATIONS_MAPPED",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "regulation_count": len(regulations),
    }
    reg_hash = compute_payload_hash(reg_payload, previous_hash)
    chained_entries.append({
        "id": str(uuid.uuid4()),
        "action": "REGULATIONS_MAPPED",
        "payload": reg_payload,
        "payload_hash": reg_hash,
        "previous_hash": previous_hash,
    })
    previous_hash = reg_hash

    # Audit entry for risk scoring
    risk_payload = {
        "action": "RISKS_SCORED",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "risk_count": len(risk_scores),
        "max_risk_score": evaluation.get("max_risk_score", 0),
    }
    risk_hash = compute_payload_hash(risk_payload, previous_hash)
    chained_entries.append({
        "id": str(uuid.uuid4()),
        "action": "RISKS_SCORED",
        "payload": risk_payload,
        "payload_hash": risk_hash,
        "previous_hash": previous_hash,
    })
    previous_hash = risk_hash

    # Audit entry for transition decision
    decision_payload = {
        "action": "TRANSITION_EVALUATED",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "approved": approved,
        "max_risk_score": evaluation.get("max_risk_score", 0),
        "recommendation": evaluation.get("recommendation", "BLOCK"),
    }
    decision_hash = compute_payload_hash(decision_payload, previous_hash)
    chained_entries.append({
        "id": str(uuid.uuid4()),
        "action": "TRANSITION_EVALUATED",
        "payload": decision_payload,
        "payload_hash": decision_hash,
        "previous_hash": previous_hash,
    })

    # Append any pre-existing entries (e.g. from approve_transition)
    for entry in existing_entries:
        if "payload_hash" not in entry:
            previous_hash = decision_hash
            entry_payload = entry
            entry_hash = compute_payload_hash(entry_payload, previous_hash)
            chained_entries.append({
                "id": str(uuid.uuid4()),
                "action": entry.get("action", "UNKNOWN"),
                "payload": entry_payload,
                "payload_hash": entry_hash,
                "previous_hash": previous_hash,
            })

    return {"audit_entries": chained_entries}


async def persist_risk(state: AgentState) -> dict[str, Any]:
    """Write risk assessments, compliance mappings, and audit logs to DB."""
    repository_id = state.get("repository_id")
    risk_scores = state.get("risk_scores", [])
    regulations = state.get("regulations", [])
    audit_entries = state.get("audit_entries", [])
    approved = state.get("approved", False)

    try:
        # Insert risk assessments
        for score_entry in risk_scores:
            assessment_id = str(uuid.uuid4())
            entity_id_from_llm = score_entry.get("entity_id")
            entity_name = score_entry.get("entity_name", "")
            entity_type_raw = score_entry.get("entity_type", "capability")

            # Resolve entity_id by name — try exact then ILIKE fuzzy match
            resolved_id = None
            if entity_name:
                table = "digital_capabilities" if entity_type_raw.lower() in ("capability", "digitalcapability") else "digital_products"
                row = await db_pool.fetchrow(f"SELECT id FROM {table} WHERE name = $1 LIMIT 1", entity_name)
                if not row:
                    row = await db_pool.fetchrow(f"SELECT id FROM {table} WHERE name ILIKE $1 LIMIT 1", f"%{entity_name}%")
                if not row:
                    # Strip common suffixes/prefixes and try again
                    short = entity_name.split("(")[0].strip()
                    row = await db_pool.fetchrow(f"SELECT id FROM {table} WHERE name ILIKE $1 LIMIT 1", f"%{short}%")
                if row:
                    resolved_id = str(row["id"])

            entity_id = resolved_id or entity_id_from_llm or assessment_id
            transition_blocked = score_entry.get("severity") == "CRITICAL"
            await db_pool.execute(
                """
                INSERT INTO risk_assessments (
                    id, entity_type, entity_id,
                    risk_category, risk_score, severity,
                    description, mitigation_plan, transition_blocked,
                    created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
                """,
                assessment_id,
                score_entry.get("entity_type", "DigitalCapability"),
                entity_id,
                score_entry.get("risk_category", ""),
                score_entry.get("risk_score", 0.0),
                score_entry.get("severity", "LOW"),
                score_entry.get("risk_description", ""),
                score_entry.get("mitigation_recommendation", ""),
                transition_blocked,
            )

        # Insert compliance mappings
        for mapping in regulations:
            mapping_id = str(uuid.uuid4())
            entity_id_from_llm = mapping.get("entity_id")
            entity_name = mapping.get("entity_name", "")
            entity_type_raw = mapping.get("entity_type", "capability")

            # Resolve entity_id by name — try exact then ILIKE fuzzy match
            resolved_id = None
            if entity_name:
                table = "digital_capabilities" if entity_type_raw.lower() in ("capability", "digitalcapability") else "digital_products"
                row = await db_pool.fetchrow(f"SELECT id FROM {table} WHERE name = $1 LIMIT 1", entity_name)
                if not row:
                    row = await db_pool.fetchrow(f"SELECT id FROM {table} WHERE name ILIKE $1 LIMIT 1", f"%{entity_name}%")
                if not row:
                    short = entity_name.split("(")[0].strip()
                    row = await db_pool.fetchrow(f"SELECT id FROM {table} WHERE name ILIKE $1 LIMIT 1", f"%{short}%")
                if row:
                    resolved_id = str(row["id"])

            entity_id = resolved_id or entity_id_from_llm or mapping_id
            await db_pool.execute(
                """
                INSERT INTO compliance_mappings (
                    id, framework, requirement, description,
                    entity_type, entity_id, status,
                    evidence_links, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], NOW(), NOW())
                """,
                mapping_id,
                mapping.get("regulation", mapping.get("framework", "")),
                mapping.get("requirement_id", mapping.get("requirement", "")),
                mapping.get("requirement_description", mapping.get("description", "")),
                entity_type_raw,
                entity_id,
                mapping.get("compliance_status", mapping.get("status", "PENDING")),
                mapping.get("evidence_links", []),
            )

        # Insert audit log entries
        for entry in audit_entries:
            entity_id = entry.get("entity_id", repository_id or entry["id"])
            await db_pool.execute(
                """
                INSERT INTO audit_logs (
                    id, action, entity_type, entity_id, actor,
                    payload, payload_hash, previous_hash, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
                """,
                entry["id"],
                entry["action"],
                entry.get("entity_type", "AgentExecution"),
                entity_id,
                "risk-compliance-agent",
                json.dumps(entry["payload"], default=str),
                entry["payload_hash"],
                entry.get("previous_hash"),
            )

        logger.info(
            "Risk/compliance results persisted for repository %s: %d risks, %d mappings, %d audit entries",
            repository_id,
            len(risk_scores),
            len(regulations),
            len(audit_entries),
        )

        # Confidence propagation: risk assessment confirms capability existence — boost by 0.08
        # Only boost capabilities that have been correctly linked (resolved entity_id)
        try:
            if repository_id:
                await db_pool.execute(
                    """
                    UPDATE digital_capabilities
                    SET confidence = LEAST(1.0, confidence + 0.08),
                        updated_at = NOW()
                    WHERE id IN (
                        SELECT DISTINCT entity_id FROM risk_assessments
                        WHERE entity_id IN (
                            SELECT dc.id FROM digital_capabilities dc
                            JOIN digital_products dp ON dp.id = dc.digital_product_id
                            WHERE dp.repository_id = $1
                        )
                    )
                    AND confidence IS NOT NULL
                    """,
                    repository_id,
                )
                logger.info("Boosted confidence for risk-validated capabilities in repo %s", repository_id)
        except Exception as boost_exc:
            logger.warning("Confidence boost after risk failed (non-fatal): %s", boost_exc)
    except Exception as exc:
        logger.error("persist_risk failed: %s", exc)
        return {"error": str(exc)}

    return {
        "results": {
            "repository_id": repository_id,
            "risk_assessments_count": len(risk_scores),
            "compliance_mappings_count": len(regulations),
            "audit_entries_count": len(audit_entries),
            "transition_approved": approved,
        }
    }


# ---------------------------------------------------------------------------
# Build the LangGraph StateGraph
# ---------------------------------------------------------------------------

graph = StateGraph(AgentState)

graph.add_node("load_context", load_context)
graph.add_node("map_regulations", map_regulations)
graph.add_node("score_risks", score_risks)
graph.add_node("evaluate_transition", evaluate_transition)
graph.add_node("approve_transition", approve_transition)
graph.add_node("create_audit_log", create_audit_log)
graph.add_node("persist_risk", persist_risk)

graph.set_entry_point("load_context")
graph.add_edge("load_context", "map_regulations")
graph.add_edge("map_regulations", "score_risks")
graph.add_edge("score_risks", "evaluate_transition")

graph.add_conditional_edges(
    "evaluate_transition",
    should_approve_transition,
    {
        "approve": "approve_transition",
        "block": "create_audit_log",
    },
)

graph.add_edge("approve_transition", "create_audit_log")
graph.add_edge("create_audit_log", "persist_risk")
graph.set_finish_point("persist_risk")

compiled_graph = graph.compile()


# ---------------------------------------------------------------------------
# Agent class
# ---------------------------------------------------------------------------


class RiskComplianceAgent(BaseAgent):
    def get_name(self) -> str:
        return "risk_compliance"

    async def run(self, input_data: dict[str, Any]) -> dict[str, Any]:
        logger.info("RiskComplianceAgent starting with input keys: %s", list(input_data.keys()))
        initial_state: AgentState = {"input_data": input_data}

        try:
            final_state = await compiled_graph.ainvoke(initial_state)
        except Exception as exc:
            logger.error("RiskComplianceAgent execution failed: %s", exc)
            return {"error": str(exc)}

        return final_state.get("results", {"error": final_state.get("error", "Unknown error")})
