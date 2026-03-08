import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from langgraph.graph import StateGraph

from app.agents.base import AgentState, BaseAgent
from app.agents.org_context import get_org_context, format_context_section, org_description
from app.agents.context_output import save_agent_context_doc
from app.agents.bm25_retrieval import bm25_rerank_for_agent
from app.core.crypto import compute_payload_hash
from app.core.database import db_pool
from app.services.claude_client import claude_client

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Node functions
# ---------------------------------------------------------------------------


async def load_products(state: AgentState) -> dict[str, Any]:
    """Load digital products from DB, optionally filtered by repository_id or product_id."""
    input_data = state["input_data"]
    repository_id = input_data.get("repository_id")
    product_id = input_data.get("product_id")
    org_id = (input_data.get("organization") or {}).get("id")

    try:
        if product_id:
            products = await db_pool.fetch(
                """
                SELECT dp.id, dp.name, dp.description, dp.current_state, dp.future_state,
                       dc.id AS capability_id, dc.name AS capability_name, dc.category
                FROM digital_products dp
                LEFT JOIN digital_capabilities dc ON dc.digital_product_id = dp.id
                WHERE dp.id = $1
                """,
                product_id,
            )
        elif repository_id:
            products = await db_pool.fetch(
                """
                SELECT dp.id, dp.name, dp.description, dp.current_state, dp.future_state,
                       dc.id AS capability_id, dc.name AS capability_name, dc.category
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
                       dc.id AS capability_id, dc.name AS capability_name, dc.category
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
                       dc.id AS capability_id, dc.name AS capability_name, dc.category
                FROM digital_products dp
                LEFT JOIN digital_capabilities dc ON dc.digital_product_id = dp.id
                """
            )

        selected_products = [dict(r) for r in products]
        logger.info("Loaded %d products for future state vision", len(selected_products))
    except Exception as exc:
        logger.error("load_products failed: %s", exc)
        selected_products = []

    return {
        "selected_products": selected_products,
        "repository_id": repository_id,
    }


async def envision_future_capabilities(state: AgentState) -> dict[str, Any]:
    """Claude envisions future state per product across automation categories."""
    selected_products = state.get("selected_products", [])
    input_data = state.get("input_data", {})
    org = get_org_context(input_data)
    input_data = bm25_rerank_for_agent(
        input_data,
        "AI automation ROI transformation case study agentification RPA efficiency gains"
    )
    ctx = format_context_section(input_data, agent_type="future_state_vision")

    vision_strategies = input_data.get("vision_strategies", [])

    # Determine which capability categories to generate based on selected strategies.
    # Keeping this strict ensures the right content appears in the right tab.
    has_automation = not vision_strategies or "automation" in vision_strategies
    has_agentification = not vision_strategies or "agentification" in vision_strategies

    if has_automation and has_agentification:
        allowed_categories = (
            "RPA_AUTOMATION | AI_ML_INTEGRATION | ADVANCED_ANALYTICS | AGENT_BASED | CONVERSATIONAL_AI"
        )
        categories_section = (
            "For each product, envision future capabilities across ALL these categories:\n"
            "- RPA_AUTOMATION: Robotic Process Automation opportunities\n"
            "- AI_ML_INTEGRATION: AI/ML model integration for predictions, classifications\n"
            "- ADVANCED_ANALYTICS: Real-time dashboards, predictive analytics, anomaly detection\n"
            "- AGENT_BASED: Autonomous AI agent workflows that can act independently\n"
            "- CONVERSATIONAL_AI: Chatbots, voice assistants, natural language interfaces\n"
        )
    elif has_automation:
        allowed_categories = "RPA_AUTOMATION | AI_ML_INTEGRATION | ADVANCED_ANALYTICS"
        categories_section = (
            "For each product, envision ONLY Modernization capabilities in these categories:\n"
            "- RPA_AUTOMATION: Robotic Process Automation opportunities\n"
            "- AI_ML_INTEGRATION: AI/ML model integration for predictions, classifications\n"
            "- ADVANCED_ANALYTICS: Real-time dashboards, predictive analytics, anomaly detection\n"
            "Do NOT generate AGENT_BASED or CONVERSATIONAL_AI capabilities.\n"
        )
    else:  # agentification only
        allowed_categories = "AGENT_BASED | CONVERSATIONAL_AI"
        categories_section = (
            "For each product, envision ONLY Agentification capabilities in these categories:\n"
            "- AGENT_BASED: Autonomous AI agent workflows that can act independently\n"
            "- CONVERSATIONAL_AI: Chatbots, voice assistants, natural language interfaces\n"
            "Do NOT generate RPA_AUTOMATION, AI_ML_INTEGRATION, or ADVANCED_ANALYTICS capabilities.\n"
        )

    strategy_emphasis = ""
    if vision_strategies:
        strategy_map = {
            "automation": "Emphasize modern automation: RPA workflows, AI/ML predictions, smart analytics.\n",
            "agentification": "Emphasize autonomous agents: multi-agent workflows, conversational interfaces.\n",
        }
        for s in vision_strategies:
            strategy_emphasis += strategy_map.get(s, "")

    # Build VSM benchmark grounding instruction when benchmarks are available
    benchmark_docs = [
        d for d in input_data.get("contextDocuments", [])
        if d.get("category", "").upper() in ("VSM_BENCHMARKS", "TRANSFORMATION_CASE_STUDIES")
    ]
    benchmark_instruction = ""
    if benchmark_docs:
        benchmark_instruction = (
            "\n\nIMPORTANT: Uploaded benchmark data is available in the context above. "
            "Use it to ground your ROI estimates and projected metrics. "
            "For each capability, generate projected_metrics with conservative/expected/optimistic "
            "bands for process_time_hrs, wait_time_hrs, and flow_efficiency_pct based on the benchmarks. "
            "If benchmark data shows specific figures (e.g. 'KYC PT reduced from 4h to 0.8h with RPA'), "
            "use those as the basis for projected_metrics."
        )
        projected_metrics_field = (
            "projected_metrics ({process_time_hrs: {conservative, expected, optimistic}, "
            "wait_time_hrs: {conservative, expected, optimistic}, "
            "flow_efficiency_pct: {conservative, expected, optimistic}, "
            "benchmark_source: string}), "
        )
    else:
        benchmark_instruction = (
            "\n\nFor each capability, estimate projected_metrics based on typical industry benchmarks "
            "for the transformation category (RPA typically reduces PT 40-60%, AI agents 60-80%). "
            "Provide conservative/expected/optimistic bands."
        )
        projected_metrics_field = (
            "projected_metrics ({process_time_hrs: {conservative, expected, optimistic}, "
            "wait_time_hrs: {conservative, expected, optimistic}, "
            "flow_efficiency_pct: {conservative, expected, optimistic}, "
            "benchmark_source: 'industry_estimate'}), "
        )

    prompt = (
        f"Envision future-state capabilities for the following digital products "
        f"in {org_description(org)}:\n\n"
        f"Products:\n{json.dumps(selected_products, indent=2, default=str)}\n\n"
        f"{ctx}"
        f"{strategy_emphasis}"
        f"{categories_section}\n"
        f"{benchmark_instruction}\n"
        f"Return a JSON array of future capabilities, each with:\n"
        f"product_name, product_id, "
        f"capabilities (list of {{"
        f"category ({allowed_categories}), "
        f"name, description, "
        f"business_impact (HIGH | MEDIUM | LOW), "
        f"implementation_complexity (HIGH | MEDIUM | LOW), "
        f"estimated_roi_pct (float), "
        f"{projected_metrics_field}"
        f"prerequisites (list of strings), "
        f"technology_stack (list of strings)"
        f"}})."
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=8192)
        future_capabilities = json.loads(raw)
        if not isinstance(future_capabilities, list):
            future_capabilities = future_capabilities.get(
                "future_capabilities", future_capabilities.get("capabilities", [])
            )
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("envision_future_capabilities failed: %s", exc)
        future_capabilities = []

    return {"future_capabilities": future_capabilities}


async def design_future_value_streams(state: AgentState) -> dict[str, Any]:
    """Create value stream for each envisioned future capability."""
    future_capabilities = state.get("future_capabilities", [])
    selected_products = state.get("selected_products", [])
    input_data = state.get("input_data", {})
    org = get_org_context(input_data)

    prompt = (
        f"Design future-state value streams for the following envisioned capabilities "
        f"in {org_description(org)}:\n\n"
        f"Current Products:\n{json.dumps(selected_products, indent=2, default=str)}\n\n"
        f"Envisioned Future Capabilities:\n{json.dumps(future_capabilities, indent=2)}\n\n"
        f"For each product, create a future-state value stream that incorporates "
        f"the envisioned capabilities. Show how the value stream transforms from "
        f"current manual/legacy processes to automated/AI-enhanced processes.\n\n"
        f"Return a JSON array of future value streams, each with:\n"
        f"product_name, product_id, "
        f"current_steps (list of {{name, type, duration_hours}}), "
        f"future_steps (list of {{name, type (manual | automated | ai_assisted | agent_driven), "
        f"duration_hours, automation_category, improvement_description}}), "
        f"efficiency_gain_pct (float), "
        f"headcount_impact (string), "
        f"customer_experience_improvement (string)."
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=8192)
        future_value_streams = json.loads(raw)
        if not isinstance(future_value_streams, list):
            future_value_streams = future_value_streams.get(
                "future_value_streams", future_value_streams.get("value_streams", [])
            )
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("design_future_value_streams failed: %s", exc)
        future_value_streams = []

    return {"future_value_streams": future_value_streams}


async def generate_vision_report(state: AgentState) -> dict[str, Any]:
    """Generate markdown report with current vs future Mermaid diagrams."""
    selected_products = state.get("selected_products", [])
    future_capabilities = state.get("future_capabilities", [])
    future_value_streams = state.get("future_value_streams", [])
    input_data = state.get("input_data", {})
    org = get_org_context(input_data)

    prompt = (
        f"Generate a comprehensive Future State Vision Report for "
        f"{org_description(org)}.\n\n"
        f"Current Products ({len(selected_products)}):\n"
        f"{json.dumps(selected_products, indent=2, default=str)}\n\n"
        f"Envisioned Future Capabilities:\n{json.dumps(future_capabilities, indent=2)}\n\n"
        f"Future Value Streams:\n{json.dumps(future_value_streams, indent=2)}\n\n"
        f"The report should include:\n"
        f"1. Executive Summary\n"
        f"2. Current State Overview\n"
        f"3. Future State Vision by Product\n"
        f"4. Future Capability Cards (grouped by category: RPA, AI/ML, Agent-based, etc.)\n"
        f"5. Current vs Future Value Stream Comparison\n"
        f"6. Mermaid Diagrams:\n"
        f"   a. Current state value stream (graph LR)\n"
        f"   b. Future state value stream (graph LR) with color coding:\n"
        f"      - classDef manual fill:#ef4444,stroke:#dc2626,color:#fff\n"
        f"      - classDef automated fill:#22c55e,stroke:#16a34a,color:#fff\n"
        f"      - classDef aiAssisted fill:#3b82f6,stroke:#2563eb,color:#fff\n"
        f"      - classDef agentDriven fill:#8b5cf6,stroke:#7c3aed,color:#fff\n"
        f"7. ROI Projections and Implementation Roadmap\n"
        f"8. Recommended Next Steps\n\n"
        f"Write in professional strategy consulting style with markdown formatting."
    )

    try:
        report = await claude_client.analyze(prompt, max_tokens=8192)
    except Exception as exc:
        logger.error("generate_vision_report failed: %s", exc)
        report = "Error generating vision report."

    return {"vision_report": report}


async def persist_vision(state: AgentState) -> dict[str, Any]:
    """Write future_state to digital_products and create audit logs."""
    repository_id = state.get("repository_id")
    selected_products = state.get("selected_products", [])
    future_capabilities = state.get("future_capabilities", [])
    future_value_streams = state.get("future_value_streams", [])
    vision_report = state.get("vision_report", "")

    try:
        # Update products with envisioned future state
        for cap_entry in future_capabilities:
            product_id = cap_entry.get("product_id")
            if not product_id:
                continue

            capabilities_summary = []
            for cap in cap_entry.get("capabilities", []):
                capabilities_summary.append(
                    f"[{cap.get('category', 'N/A')}] {cap.get('name', '')}: "
                    f"{cap.get('description', '')[:100]}"
                )

            future_state = "Future capabilities: " + "; ".join(capabilities_summary[:5])
            if len(future_state) > 1000:
                future_state = future_state[:997] + "..."

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

        vision_payload = {
            "action": "FUTURE_STATE_ENVISIONED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "products_count": len(selected_products),
            "capabilities_count": sum(
                len(c.get("capabilities", [])) for c in future_capabilities
            ),
            "value_streams_count": len(future_value_streams),
        }
        vision_hash = compute_payload_hash(vision_payload, previous_hash)
        audit_id_1 = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO audit_logs (
                id, action, entity_type, entity_id, actor,
                payload, payload_hash, previous_hash, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
            """,
            audit_id_1,
            "FUTURE_STATE_ENVISIONED",
            "AgentExecution",
            repository_id or audit_id_1,
            "future-state-vision-agent",
            json.dumps(vision_payload, default=str),
            vision_hash,
            previous_hash,
        )
        previous_hash = vision_hash

        report_payload = {
            "action": "VISION_REPORT_GENERATED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "report_length": len(vision_report),
        }
        report_hash = compute_payload_hash(report_payload, previous_hash)
        audit_id_2 = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO audit_logs (
                id, action, entity_type, entity_id, actor,
                payload, payload_hash, previous_hash, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
            """,
            audit_id_2,
            "VISION_REPORT_GENERATED",
            "AgentExecution",
            repository_id or audit_id_2,
            "future-state-vision-agent",
            json.dumps(report_payload, default=str),
            report_hash,
            previous_hash,
        )

        logger.info(
            "Future state vision results persisted: %d products, %d capabilities",
            len(selected_products),
            len(future_capabilities),
        )
    except Exception as exc:
        logger.error("persist_vision failed: %s", exc)
        return {"error": str(exc)}

    # Flatten capabilities for roadmap consumption
    flattened_capabilities = []
    for cap_entry in future_capabilities:
        for cap in cap_entry.get("capabilities", []):
            entry: dict[str, Any] = {
                "name": cap.get("name", ""),
                "category": cap.get("category", ""),
                "description": cap.get("description", ""),
                "businessImpact": cap.get("business_impact", cap.get("businessImpact", "MEDIUM")),
                "complexity": cap.get("implementation_complexity", cap.get("complexity", "MEDIUM")),
                "estimated_roi_pct": cap.get("estimated_roi_pct"),
                "product_name": cap_entry.get("product_name", ""),
                "product_id": cap_entry.get("product_id", ""),
            }
            # Preserve benchmark-grounded projected_metrics so downstream agents and KB can use them
            if cap.get("projected_metrics"):
                entry["projected_metrics"] = cap["projected_metrics"]
            flattened_capabilities.append(entry)

    # Auto-save output as AGENT_OUTPUT ContextDocument for cross-agent chaining
    org_id = str(input_data.get("organization", {}).get("id", ""))
    org_name = input_data.get("organization", {}).get("name", "Enterprise")
    if org_id:
        await save_agent_context_doc(
            "future_state_vision", org_id, org_name,
            {"capabilities": flattened_capabilities, "future_value_streams": future_value_streams,
             "products_count": len(selected_products)},
        )

    return {
        "results": {
            "repository_id": repository_id,
            "products_analyzed": len(selected_products),
            "future_capabilities_count": len(flattened_capabilities),
            "future_value_streams_count": len(future_value_streams),
            "vision_report_generated": bool(vision_report),
            "capabilities": flattened_capabilities,
            "vision_report": vision_report,
            "future_value_streams": future_value_streams,
        }
    }


# ---------------------------------------------------------------------------
# Build the LangGraph StateGraph
# ---------------------------------------------------------------------------

graph = StateGraph(AgentState)

graph.add_node("load_products", load_products)
graph.add_node("envision_future_capabilities", envision_future_capabilities)
graph.add_node("design_future_value_streams", design_future_value_streams)
graph.add_node("generate_vision_report", generate_vision_report)
graph.add_node("persist_vision", persist_vision)

graph.set_entry_point("load_products")
graph.add_edge("load_products", "envision_future_capabilities")
graph.add_edge("envision_future_capabilities", "design_future_value_streams")
graph.add_edge("design_future_value_streams", "generate_vision_report")
graph.add_edge("generate_vision_report", "persist_vision")
graph.set_finish_point("persist_vision")

compiled_graph = graph.compile()


# ---------------------------------------------------------------------------
# Agent class
# ---------------------------------------------------------------------------


class FutureStateVisionAgent(BaseAgent):
    def get_name(self) -> str:
        return "future_state_vision"

    async def run(self, input_data: dict[str, Any]) -> dict[str, Any]:
        logger.info("FutureStateVisionAgent starting with input keys: %s", list(input_data.keys()))
        initial_state: AgentState = {"input_data": input_data}

        try:
            final_state = await compiled_graph.ainvoke(initial_state)
        except Exception as exc:
            logger.error("FutureStateVisionAgent execution failed: %s", exc)
            return {"error": str(exc)}

        return final_state.get("results", {"error": final_state.get("error", "Unknown error")})
