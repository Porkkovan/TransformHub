import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from langgraph.graph import StateGraph

from app.agents.base import AgentState, BaseAgent
from app.core.crypto import compute_payload_hash
from app.core.database import db_pool
from app.services.claude_client import claude_client
from app.agents.org_context import get_org_context, format_context_section, format_frameworks, org_description

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Node functions
# ---------------------------------------------------------------------------


async def load_data_context(state: AgentState) -> dict[str, Any]:
    """Load capabilities, products, and existing compliance mappings (especially GDPR)."""
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

        gdpr_mappings = await db_pool.fetch(
            """
            SELECT id, framework, requirement, description, entity_type, entity_id, status
            FROM compliance_mappings
            WHERE framework = 'GDPR'
            """
        )

        data_context = {
            "repository_id": repository_id,
            "capabilities": [dict(r) for r in capabilities],
            "products": [dict(r) for r in products],
            "gdpr_mappings": [dict(r) for r in gdpr_mappings],
        }

        logger.info(
            "Loaded data context: %d capabilities, %d products, %d GDPR mappings",
            len(capabilities),
            len(products),
            len(gdpr_mappings),
        )
    except Exception as exc:
        logger.error("load_data_context failed: %s", exc)
        data_context = {
            "repository_id": repository_id,
            "capabilities": [],
            "products": [],
            "gdpr_mappings": [],
        }

    return {"data_context": data_context, "repository_id": repository_id}


async def classify_data_assets(state: AgentState) -> dict[str, Any]:
    """Identify and classify data assets (PII, financial, behavioral) per capability."""
    org = get_org_context(state["input_data"])
    ctx = format_context_section(state["input_data"])
    data_context = state.get("data_context", {})

    prompt = (
        f"Identify and classify data assets for the following "
        f"{org_description(org)} capabilities:\n\n"
        f"Capabilities:\n{json.dumps(data_context.get('capabilities', []), indent=2)}\n\n"
        f"Products:\n{json.dumps(data_context.get('products', []), indent=2)}\n\n"
        f"{ctx}"
        f"For each capability, identify what data assets it processes and classify them:\n"
        f"- PII (Personally Identifiable Information): names, SSN, addresses, etc.\n"
        f"- FINANCIAL: account numbers, balances, transactions, domain-specific records\n"
        f"- BEHAVIORAL: browsing patterns, trading behavior, preferences\n"
        f"- SENSITIVE: health data, political affiliations (GDPR Article 9 special categories)\n\n"
        f"Return a JSON array of data classifications, each with:\n"
        f"capability_name, capability_id, "
        f"data_assets (list of {{asset_name, classification (PII | FINANCIAL | BEHAVIORAL | SENSITIVE), "
        f"sensitivity_level (HIGH | MEDIUM | LOW), storage_type (database | file | cache | external), "
        f"retention_requirement, description}}), "
        f"overall_data_risk (HIGH | MEDIUM | LOW)."
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=8192)
        classifications = json.loads(raw)
        if not isinstance(classifications, list):
            classifications = classifications.get("data_classifications", classifications.get("classifications", []))
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("classify_data_assets failed: %s", exc)
        classifications = []

    return {"data_classifications": classifications}


async def assess_privacy_compliance(state: AgentState) -> dict[str, Any]:
    """Evaluate GDPR Articles 6, 9, 22, 25, 35 compliance for each data asset."""
    org = get_org_context(state["input_data"])
    data_classifications = state.get("data_classifications", [])
    data_context = state.get("data_context", {})

    frameworks = format_frameworks(org['regulatory_frameworks'])
    prompt = (
        f"Assess data privacy compliance ({frameworks}) for the following classified "
        f"data assets in {org_description(org)}:\n\n"
        f"Data Classifications:\n{json.dumps(data_classifications, indent=2)}\n\n"
        f"Existing GDPR Mappings:\n{json.dumps(data_context.get('gdpr_mappings', []), indent=2)}\n\n"
        f"Evaluate compliance against the applicable regulatory frameworks ({frameworks}).\n"
        f"For data privacy frameworks (e.g., GDPR, HIPAA, CCPA), assess:\n"
        f"- Lawful basis for processing and data collection\n"
        f"- Special categories and sensitive data handling\n"
        f"- Automated decision-making safeguards\n"
        f"- Privacy by design implementation\n"
        f"- Impact assessment requirements\n\n"
        f"Return a JSON array of privacy assessments, each with:\n"
        f"capability_name, capability_id, "
        f"article_6 ({{status: COMPLIANT | NON_COMPLIANT | PARTIAL, lawful_basis, gaps}}), "
        f"article_9 ({{applicable: bool, status, special_categories, safeguards}}), "
        f"article_22 ({{applicable: bool, status, automated_decisions, human_oversight}}), "
        f"article_25 ({{status, privacy_by_design_measures, gaps}}), "
        f"article_35 ({{dpia_required: bool, risk_level, recommended_actions}}), "
        f"overall_compliance (COMPLIANT | NON_COMPLIANT | PARTIAL)."
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=8192)
        privacy_assessment = json.loads(raw)
        if not isinstance(privacy_assessment, list):
            privacy_assessment = privacy_assessment.get("privacy_assessments", privacy_assessment.get("assessments", []))
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("assess_privacy_compliance failed: %s", exc)
        privacy_assessment = []

    return {"privacy_assessment": privacy_assessment}


async def generate_governance_policies(state: AgentState) -> dict[str, Any]:
    """Generate data governance policies -- retention, consent, anonymization."""
    org = get_org_context(state["input_data"])
    data_classifications = state.get("data_classifications", [])
    privacy_assessment = state.get("privacy_assessment", [])

    prompt = (
        f"Generate comprehensive data governance policies for "
        f"{org_description(org)} based on the following assessments:\n\n"
        f"Data Classifications:\n{json.dumps(data_classifications, indent=2)}\n\n"
        f"Privacy Compliance Assessment:\n{json.dumps(privacy_assessment, indent=2)}\n\n"
        f"Generate policies covering:\n"
        f"1. Data Retention Policy (per data classification type)\n"
        f"2. Consent Management Policy (opt-in/opt-out, granularity, withdrawal)\n"
        f"3. Data Anonymization & Pseudonymization Policy\n"
        f"4. Data Subject Rights Policy (access, rectification, erasure, portability)\n"
        f"5. Data Breach Notification Policy (72-hour rule)\n"
        f"6. AI/ML Training Data Policy (what data can be used for model training)\n"
        f"7. Cross-Border Data Transfer Policy\n\n"
        f"Write in professional policy document style with markdown formatting. "
        f"Include specific timeframes, procedures, and responsibilities."
    )

    try:
        policies = await claude_client.analyze(prompt, max_tokens=8192)
    except Exception as exc:
        logger.error("generate_governance_policies failed: %s", exc)
        policies = "Error generating governance policies."

    return {"governance_policies": policies}


async def persist_governance(state: AgentState) -> dict[str, Any]:
    """Write compliance mappings + risk assessments + audit log entries."""
    repository_id = state.get("repository_id")
    data_classifications = state.get("data_classifications", [])
    privacy_assessment = state.get("privacy_assessment", [])
    governance_policies = state.get("governance_policies", "")

    try:
        async def resolve_cap_id(entry: dict, fallback: str) -> str:
            name = entry.get("capability_name", "")
            if name:
                row = await db_pool.fetchrow(
                    "SELECT id FROM digital_capabilities WHERE name = $1 LIMIT 1", name
                )
                if row:
                    return str(row["id"])
            return entry.get("capability_id") or fallback

        # Insert compliance mappings for GDPR assessments
        for assessment in privacy_assessment:
            assessment_id_fallback = str(uuid.uuid4())
            cap_id = await resolve_cap_id(assessment, assessment_id_fallback)
            overall = assessment.get("overall_compliance", "NEEDS_REVIEW")

            for article in ["article_6", "article_9", "article_22", "article_25", "article_35"]:
                article_data = assessment.get(article, {})
                if not article_data:
                    continue
                status = article_data.get("status", "NEEDS_REVIEW")
                if isinstance(article_data.get("applicable"), bool) and not article_data["applicable"]:
                    continue

                mapping_id = str(uuid.uuid4())
                gaps = article_data.get("gaps", article_data.get("recommended_actions", ""))
                if isinstance(gaps, list):
                    gaps = "; ".join(gaps)

                await db_pool.execute(
                    """
                    INSERT INTO compliance_mappings (
                        id, framework, requirement, description,
                        entity_type, entity_id, status,
                        evidence_links, created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], NOW(), NOW())
                    """,
                    mapping_id,
                    "GDPR",
                    f"GDPR {article.replace('_', ' ').title()}",
                    str(gaps) if gaps else "",
                    "DigitalCapability",
                    cap_id or mapping_id,
                    status,
                    [],
                )

        # Insert risk assessments for high-risk data assets
        for classification in data_classifications:
            if classification.get("overall_data_risk") in ("HIGH", "MEDIUM"):
                assessment_id = str(uuid.uuid4())
                risk_score = 7.5 if classification.get("overall_data_risk") == "HIGH" else 5.0
                severity = "HIGH" if classification.get("overall_data_risk") == "HIGH" else "MEDIUM"
                cap_id_for_risk = await resolve_cap_id(classification, assessment_id)

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
                    "DigitalCapability",
                    cap_id_for_risk,
                    "DATA_PRIVACY",
                    risk_score,
                    severity,
                    f"Data governance risk for {classification.get('capability_name', 'unknown')}",
                    "Implement data governance policies as outlined in governance report",
                    False,
                )

        # Build audit chain
        previous_hash: str | None = None

        classify_payload = {
            "action": "DATA_ASSETS_CLASSIFIED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "classifications_count": len(data_classifications),
        }
        classify_hash = compute_payload_hash(classify_payload, previous_hash)
        audit_id_1 = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO audit_logs (
                id, action, entity_type, entity_id, actor,
                payload, payload_hash, previous_hash, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
            """,
            audit_id_1,
            "DATA_ASSETS_CLASSIFIED",
            "AgentExecution",
            repository_id or audit_id_1,
            "data-governance-agent",
            json.dumps(classify_payload, default=str),
            classify_hash,
            previous_hash,
        )
        previous_hash = classify_hash

        privacy_payload = {
            "action": "PRIVACY_COMPLIANCE_ASSESSED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "assessments_count": len(privacy_assessment),
        }
        privacy_hash = compute_payload_hash(privacy_payload, previous_hash)
        audit_id_2 = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO audit_logs (
                id, action, entity_type, entity_id, actor,
                payload, payload_hash, previous_hash, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
            """,
            audit_id_2,
            "PRIVACY_COMPLIANCE_ASSESSED",
            "AgentExecution",
            repository_id or audit_id_2,
            "data-governance-agent",
            json.dumps(privacy_payload, default=str),
            privacy_hash,
            previous_hash,
        )
        previous_hash = privacy_hash

        policies_payload = {
            "action": "GOVERNANCE_POLICIES_GENERATED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "policies_length": len(governance_policies),
        }
        policies_hash = compute_payload_hash(policies_payload, previous_hash)
        audit_id_3 = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO audit_logs (
                id, action, entity_type, entity_id, actor,
                payload, payload_hash, previous_hash, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
            """,
            audit_id_3,
            "GOVERNANCE_POLICIES_GENERATED",
            "AgentExecution",
            repository_id or audit_id_3,
            "data-governance-agent",
            json.dumps(policies_payload, default=str),
            policies_hash,
            previous_hash,
        )

        logger.info(
            "Data governance results persisted: %d classifications, %d privacy assessments",
            len(data_classifications),
            len(privacy_assessment),
        )
    except Exception as exc:
        logger.error("persist_governance failed: %s", exc)
        return {"error": str(exc)}

    return {
        "results": {
            "repository_id": repository_id,
            "data_classifications_count": len(data_classifications),
            "privacy_assessments_count": len(privacy_assessment),
            "governance_policies_generated": bool(governance_policies),
        }
    }


# ---------------------------------------------------------------------------
# Build the LangGraph StateGraph
# ---------------------------------------------------------------------------

graph = StateGraph(AgentState)

graph.add_node("load_data_context", load_data_context)
graph.add_node("classify_data_assets", classify_data_assets)
graph.add_node("assess_privacy_compliance", assess_privacy_compliance)
graph.add_node("generate_governance_policies", generate_governance_policies)
graph.add_node("persist_governance", persist_governance)

graph.set_entry_point("load_data_context")
graph.add_edge("load_data_context", "classify_data_assets")
graph.add_edge("classify_data_assets", "assess_privacy_compliance")
graph.add_edge("assess_privacy_compliance", "generate_governance_policies")
graph.add_edge("generate_governance_policies", "persist_governance")
graph.set_finish_point("persist_governance")

compiled_graph = graph.compile()


# ---------------------------------------------------------------------------
# Agent class
# ---------------------------------------------------------------------------


class DataGovernanceAgent(BaseAgent):
    def get_name(self) -> str:
        return "data_governance"

    async def run(self, input_data: dict[str, Any]) -> dict[str, Any]:
        logger.info("DataGovernanceAgent starting with input keys: %s", list(input_data.keys()))
        initial_state: AgentState = {"input_data": input_data}

        try:
            final_state = await compiled_graph.ainvoke(initial_state)
        except Exception as exc:
            logger.error("DataGovernanceAgent execution failed: %s", exc)
            return {"error": str(exc)}

        return final_state.get("results", {"error": final_state.get("error", "Unknown error")})
