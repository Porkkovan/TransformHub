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
from app.services.claude_client import claude_client

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Node functions
# ---------------------------------------------------------------------------


async def load_advisor_context(state: AgentState) -> dict[str, Any]:
    """Load capabilities, products, persona mappings (FRONT_OFFICE), and existing compliance mappings from DB."""
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
                SELECT dp.id, dp.name, dp.description
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
                SELECT dp.id, dp.name, dp.description
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
                "SELECT id, name, description FROM digital_products"
            )

        persona_mappings = await db_pool.fetch(
            """
            SELECT id, functionality_id, persona_type, persona_name, responsibilities
            FROM persona_mappings
            WHERE persona_type = 'FRONT_OFFICE'
            """
        )

        existing_compliance = await db_pool.fetch(
            "SELECT id, framework, requirement, description, entity_type, entity_id, status FROM compliance_mappings"
        )

        advisor_context = {
            "repository_id": repository_id,
            "capabilities": [dict(r) for r in capabilities],
            "products": [dict(r) for r in products],
            "persona_mappings": [dict(r) for r in persona_mappings],
            "existing_compliance": [dict(r) for r in existing_compliance],
        }

        logger.info(
            "Loaded advisor context: %d capabilities, %d products, %d persona mappings",
            len(capabilities),
            len(products),
            len(persona_mappings),
        )
    except Exception as exc:
        logger.error("load_advisor_context failed: %s", exc)
        advisor_context = {
            "repository_id": repository_id,
            "capabilities": [],
            "products": [],
            "persona_mappings": [],
            "existing_compliance": [],
        }

    return {"advisor_context": advisor_context, "repository_id": repository_id}


async def assess_suitability(state: AgentState) -> dict[str, Any]:
    """Analyze each capability/product against FINRA Rule 2111 suitability requirements."""
    org = get_org_context(state["input_data"])
    ctx = format_context_section(state["input_data"])
    advisor_context = state.get("advisor_context", {})

    frameworks = format_frameworks(org['regulatory_frameworks'])
    prompt = (
        f"Analyze the following {org_description(org)} capabilities and products "
        f"for regulatory compliance ({frameworks}):\n\n"
        f"Capabilities:\n{json.dumps(advisor_context.get('capabilities', []), indent=2)}\n\n"
        f"Products:\n{json.dumps(advisor_context.get('products', []), indent=2)}\n\n"
        f"Front-Office Persona Mappings:\n{json.dumps(advisor_context.get('persona_mappings', []), indent=2)}\n\n"
        f"{ctx}"
        f"For each capability/product, assess compliance against the applicable frameworks ({frameworks}):\n"
        f"- Regulatory alignment: Does it meet the framework requirements?\n"
        f"- Risk exposure: What compliance gaps exist?\n"
        f"- Control adequacy: Are controls sufficient for the regulatory requirements?\n\n"
        f"Return a JSON array of suitability assessments, each with:\n"
        f"entity_type (capability | product), entity_name, entity_id, "
        f"reasonable_basis (PASS | FAIL | NEEDS_REVIEW), "
        f"customer_specific (PASS | FAIL | NEEDS_REVIEW), "
        f"quantitative (PASS | FAIL | NEEDS_REVIEW | N/A), "
        f"overall_suitability (SUITABLE | UNSUITABLE | NEEDS_REVIEW), "
        f"findings (string), recommendations (string)."
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=8192)
        suitability = json.loads(raw)
        if not isinstance(suitability, list):
            suitability = suitability.get("suitability_assessments", suitability.get("assessments", []))
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("assess_suitability failed: %s", exc)
        suitability = []

    return {"suitability_assessment": suitability}


async def evaluate_best_interest(state: AgentState) -> dict[str, Any]:
    """Evaluate against SEC Reg BI -- best interest standard for recommendations."""
    org = get_org_context(state["input_data"])
    advisor_context = state.get("advisor_context", {})
    suitability = state.get("suitability_assessment", [])

    frameworks = format_frameworks(org['regulatory_frameworks'])
    prompt = (
        f"Evaluate the following {org_description(org)} against "
        f"regulatory obligations ({frameworks}):\n\n"
        f"Capabilities:\n{json.dumps(advisor_context.get('capabilities', []), indent=2)}\n\n"
        f"Products:\n{json.dumps(advisor_context.get('products', []), indent=2)}\n\n"
        f"Suitability Assessment Results:\n{json.dumps(suitability, indent=2)}\n\n"
        f"Evaluate each component against regulatory obligations:\n"
        f"- Disclosure: Are material facts and requirements properly disclosed?\n"
        f"- Due diligence: Is reasonable care and diligence exercised?\n"
        f"- Conflict management: Are conflicts of interest identified and mitigated?\n"
        f"- Policy compliance: Are required policies and procedures established?\n\n"
        f"Return a JSON array, each with:\n"
        f"entity_type, entity_name, entity_id, "
        f"disclosure (COMPLIANT | NON_COMPLIANT | PARTIAL), "
        f"care (COMPLIANT | NON_COMPLIANT | PARTIAL), "
        f"conflict_of_interest (COMPLIANT | NON_COMPLIANT | PARTIAL), "
        f"compliance (COMPLIANT | NON_COMPLIANT | PARTIAL), "
        f"overall_reg_bi (COMPLIANT | NON_COMPLIANT | PARTIAL), "
        f"gaps (string), remediation_steps (string)."
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=8192)
        best_interest = json.loads(raw)
        if not isinstance(best_interest, list):
            best_interest = best_interest.get("evaluations", best_interest.get("best_interest", []))
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("evaluate_best_interest failed: %s", exc)
        best_interest = []

    return {"best_interest_evaluation": best_interest}


async def generate_fiduciary_report(state: AgentState) -> dict[str, Any]:
    """Generate a comprehensive fiduciary compliance report in markdown."""
    org = get_org_context(state["input_data"])
    suitability = state.get("suitability_assessment", [])
    best_interest = state.get("best_interest_evaluation", [])
    advisor_context = state.get("advisor_context", {})

    frameworks = format_frameworks(org['regulatory_frameworks'])
    prompt = (
        f"Generate a comprehensive Regulatory Compliance Report in professional markdown "
        f"for {org_description(org)} transformation.\n\n"
        f"Suitability Assessment (FINRA 2111):\n{json.dumps(suitability, indent=2)}\n\n"
        f"Best Interest Evaluation (SEC Reg BI):\n{json.dumps(best_interest, indent=2)}\n\n"
        f"Platform capabilities count: {len(advisor_context.get('capabilities', []))}\n"
        f"Platform products count: {len(advisor_context.get('products', []))}\n\n"
        f"The report should include:\n"
        f"1. Executive Summary\n"
        f"2. Regulatory Framework Analysis ({frameworks})\n"
        f"3. Compliance Obligation Evaluation\n"
        f"4. Gap Analysis and Risk Areas\n"
        f"5. Remediation Roadmap with priority rankings\n"
        f"6. Compliance Monitoring Recommendations\n\n"
        f"Write in professional regulatory compliance style."
    )

    try:
        report = await claude_client.analyze(prompt, max_tokens=8192)
    except Exception as exc:
        logger.error("generate_fiduciary_report failed: %s", exc)
        report = "Error generating fiduciary report."

    return {"fiduciary_report": report}


async def persist_fiduciary(state: AgentState) -> dict[str, Any]:
    """Write compliance mappings + audit log entries to DB."""
    repository_id = state.get("repository_id")
    suitability = state.get("suitability_assessment", [])
    best_interest = state.get("best_interest_evaluation", [])
    fiduciary_report = state.get("fiduciary_report", "")

    try:
        async def resolve_entity_id(entry: dict, fallback: str) -> str:
            name = entry.get("entity_name", "")
            etype = entry.get("entity_type", "capability").lower()
            if name:
                if etype in ("capability", "digitalcapability"):
                    row = await db_pool.fetchrow(
                        "SELECT id FROM digital_capabilities WHERE name = $1 LIMIT 1", name
                    )
                else:
                    row = await db_pool.fetchrow(
                        "SELECT id FROM digital_products WHERE name = $1 LIMIT 1", name
                    )
                if row:
                    return str(row["id"])
            return entry.get("entity_id") or fallback

        # Insert compliance mappings for suitability findings
        for entry in suitability:
            mapping_id = str(uuid.uuid4())
            entity_id = await resolve_entity_id(entry, mapping_id)
            await db_pool.execute(
                """
                INSERT INTO compliance_mappings (
                    id, framework, requirement, description,
                    entity_type, entity_id, status,
                    evidence_links, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], NOW(), NOW())
                """,
                mapping_id,
                "FINRA",
                "Rule 2111 - Suitability",
                entry.get("findings", ""),
                entry.get("entity_type", "DigitalCapability"),
                entity_id,
                entry.get("overall_suitability", "NEEDS_REVIEW"),
                [],
            )

        # Insert compliance mappings for Reg BI findings
        for entry in best_interest:
            mapping_id = str(uuid.uuid4())
            entity_id = await resolve_entity_id(entry, mapping_id)
            await db_pool.execute(
                """
                INSERT INTO compliance_mappings (
                    id, framework, requirement, description,
                    entity_type, entity_id, status,
                    evidence_links, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], NOW(), NOW())
                """,
                mapping_id,
                "SEC",
                "Reg BI - Best Interest",
                entry.get("gaps", ""),
                entry.get("entity_type", "DigitalCapability"),
                entity_id,
                entry.get("overall_reg_bi", "NEEDS_REVIEW"),
                [],
            )

        # Build audit chain
        previous_hash: str | None = None

        suitability_payload = {
            "action": "SUITABILITY_ASSESSED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "assessments_count": len(suitability),
        }
        suitability_hash = compute_payload_hash(suitability_payload, previous_hash)
        audit_id_1 = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO audit_logs (
                id, action, entity_type, entity_id, actor,
                payload, payload_hash, previous_hash, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
            """,
            audit_id_1,
            "SUITABILITY_ASSESSED",
            "AgentExecution",
            repository_id or audit_id_1,
            "fiduciary-agent",
            json.dumps(suitability_payload, default=str),
            suitability_hash,
            previous_hash,
        )
        previous_hash = suitability_hash

        best_interest_payload = {
            "action": "BEST_INTEREST_EVALUATED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "evaluations_count": len(best_interest),
        }
        best_interest_hash = compute_payload_hash(best_interest_payload, previous_hash)
        audit_id_2 = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO audit_logs (
                id, action, entity_type, entity_id, actor,
                payload, payload_hash, previous_hash, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
            """,
            audit_id_2,
            "BEST_INTEREST_EVALUATED",
            "AgentExecution",
            repository_id or audit_id_2,
            "fiduciary-agent",
            json.dumps(best_interest_payload, default=str),
            best_interest_hash,
            previous_hash,
        )
        previous_hash = best_interest_hash

        report_payload = {
            "action": "FIDUCIARY_REPORT_GENERATED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "report_length": len(fiduciary_report),
        }
        report_hash = compute_payload_hash(report_payload, previous_hash)
        audit_id_3 = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO audit_logs (
                id, action, entity_type, entity_id, actor,
                payload, payload_hash, previous_hash, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
            """,
            audit_id_3,
            "FIDUCIARY_REPORT_GENERATED",
            "AgentExecution",
            repository_id or audit_id_3,
            "fiduciary-agent",
            json.dumps(report_payload, default=str),
            report_hash,
            previous_hash,
        )

        logger.info(
            "Fiduciary results persisted: %d suitability, %d best-interest mappings",
            len(suitability),
            len(best_interest),
        )
    except Exception as exc:
        logger.error("persist_fiduciary failed: %s", exc)
        return {"error": str(exc)}

    return {
        "results": {
            "repository_id": repository_id,
            "suitability_assessments_count": len(suitability),
            "best_interest_evaluations_count": len(best_interest),
            "fiduciary_report_generated": bool(fiduciary_report),
        }
    }


# ---------------------------------------------------------------------------
# Build the LangGraph StateGraph
# ---------------------------------------------------------------------------

graph = StateGraph(AgentState)

graph.add_node("load_advisor_context", load_advisor_context)
graph.add_node("assess_suitability", assess_suitability)
graph.add_node("evaluate_best_interest", evaluate_best_interest)
graph.add_node("generate_fiduciary_report", generate_fiduciary_report)
graph.add_node("persist_fiduciary", persist_fiduciary)

graph.set_entry_point("load_advisor_context")
graph.add_edge("load_advisor_context", "assess_suitability")
graph.add_edge("assess_suitability", "evaluate_best_interest")
graph.add_edge("evaluate_best_interest", "generate_fiduciary_report")
graph.add_edge("generate_fiduciary_report", "persist_fiduciary")
graph.set_finish_point("persist_fiduciary")

compiled_graph = graph.compile()


# ---------------------------------------------------------------------------
# Agent class
# ---------------------------------------------------------------------------


class FiduciaryAgent(BaseAgent):
    def get_name(self) -> str:
        return "fiduciary"

    async def run(self, input_data: dict[str, Any]) -> dict[str, Any]:
        logger.info("FiduciaryAgent starting with input keys: %s", list(input_data.keys()))
        initial_state: AgentState = {"input_data": input_data}

        try:
            final_state = await compiled_graph.ainvoke(initial_state)
        except Exception as exc:
            logger.error("FiduciaryAgent execution failed: %s", exc)
            return {"error": str(exc)}

        return final_state.get("results", {"error": final_state.get("error", "Unknown error")})
