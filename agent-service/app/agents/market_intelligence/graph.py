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
from app.agents.org_context import get_org_context, format_context_section, format_competitors, org_description

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Node functions
# ---------------------------------------------------------------------------


async def load_current_state(state: AgentState) -> dict[str, Any]:
    """Load digital capabilities and products with current/future state fields."""
    input_data = state["input_data"]
    repository_id = input_data.get("repository_id")

    try:
        if repository_id:
            capabilities = await db_pool.fetch(
                """
                SELECT dc.id, dc.name, dc.description, dc.category, dc.digital_product_id
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
                SELECT dc.id, dc.name, dc.description, dc.category, dc.digital_product_id
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
                "SELECT id, name, description, category, digital_product_id FROM digital_capabilities"
            )
            products = await db_pool.fetch(
                "SELECT id, name, description, current_state, future_state FROM digital_products"
            )

        current_state_data = []
        for cap in capabilities:
            cap_dict = dict(cap)
            cap_products = [dict(p) for p in products if p["id"] == cap.get("digital_product_id")]
            cap_dict["products"] = cap_products
            current_state_data.append(cap_dict)

        logger.info(
            "Loaded current state: %d capabilities, %d products",
            len(capabilities),
            len(products),
        )
    except Exception as exc:
        logger.error("load_current_state failed: %s", exc)
        current_state_data = []

    return {"current_state_data": current_state_data, "repository_id": repository_id}


async def analyze_market_trends(state: AgentState) -> dict[str, Any]:
    """Analyze wealth management industry trends affecting each capability."""
    org = get_org_context(state["input_data"])
    ctx = format_context_section(state["input_data"], agent_type="market_intelligence")
    current_state_data = state.get("current_state_data", [])

    prompt = (
        f"Analyze {org['industry_type']} industry trends affecting the following digital "
        f"capabilities:\n"
        f"{json.dumps(current_state_data, indent=2, default=str)}\n\n"
        f"{ctx}"
        f"For each capability, identify:\n"
        f"- Key industry trends (AI/ML, robo-advisory, ESG investing, open banking, etc.)\n"
        f"- Technology disruptions relevant to this capability\n"
        f"- Regulatory changes driving transformation\n"
        f"- Client expectation shifts\n\n"
        f"Return a JSON array of trend analyses, each with:\n"
        f"capability_name, capability_id, "
        f"trends (list of {{trend_name, impact (HIGH | MEDIUM | LOW), description, timeline}}), "
        f"disruption_risk (HIGH | MEDIUM | LOW), "
        f"opportunity_score (1-10), strategic_implication (string)."
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=8192)
        market_trends = json.loads(raw)
        if not isinstance(market_trends, list):
            market_trends = market_trends.get("trend_analyses", market_trends.get("trends", []))
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("analyze_market_trends failed: %s", exc)
        market_trends = []

    return {"market_trends": market_trends}


async def benchmark_competitors(state: AgentState) -> dict[str, Any]:
    """Benchmark current capabilities against industry-standard digital offerings."""
    org = get_org_context(state["input_data"])
    current_state_data = state.get("current_state_data", [])
    market_trends = state.get("market_trends", [])

    prompt = (
        f"Benchmark the following {org_description(org)} capabilities against "
        f"industry-standard digital offerings from leading competitors "
        f"({format_competitors(org['competitors'])}):\n\n"
        f"Current capabilities:\n{json.dumps(current_state_data, indent=2, default=str)}\n\n"
        f"Market trends:\n{json.dumps(market_trends, indent=2)}\n\n"
        f"For each capability, provide:\n"
        f"- Current maturity level (1-5 scale)\n"
        f"- Industry benchmark level (1-5 scale)\n"
        f"- Gap analysis\n"
        f"- Competitive positioning (LEADER | FAST_FOLLOWER | LAGGARD)\n\n"
        f"Return a JSON array of benchmarks, each with:\n"
        f"capability_name, capability_id, "
        f"current_maturity (1-5), industry_benchmark (1-5), maturity_gap (float), "
        f"competitive_position (LEADER | FAST_FOLLOWER | LAGGARD), "
        f"best_in_class_example (string), gap_description (string), "
        f"recommended_investments (list of strings)."
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=8192)
        benchmarks = json.loads(raw)
        if not isinstance(benchmarks, list):
            benchmarks = benchmarks.get("benchmarks", benchmarks.get("competitor_benchmarks", []))
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("benchmark_competitors failed: %s", exc)
        benchmarks = []

    return {"competitor_benchmarks": benchmarks}


async def generate_intelligence_report(state: AgentState) -> dict[str, Any]:
    """Synthesize a market intelligence report with prioritized recommendations."""
    org = get_org_context(state["input_data"])
    current_state_data = state.get("current_state_data", [])
    market_trends = state.get("market_trends", [])
    benchmarks = state.get("competitor_benchmarks", [])

    prompt = (
        f"Generate a comprehensive Market Intelligence Report for {org_description(org)} "
        f"platform transformation.\n\n"
        f"Current State ({len(current_state_data)} capabilities):\n"
        f"{json.dumps(current_state_data, indent=2, default=str)}\n\n"
        f"Market Trends:\n{json.dumps(market_trends, indent=2)}\n\n"
        f"Competitive Benchmarks:\n{json.dumps(benchmarks, indent=2)}\n\n"
        f"The report should include:\n"
        f"1. Executive Summary\n"
        f"2. Market Landscape Analysis\n"
        f"3. Competitive Positioning Matrix\n"
        f"4. Technology Trend Impact Assessment\n"
        f"5. Prioritized Transformation Recommendations (ranked by strategic value)\n"
        f"6. Investment Roadmap with quick wins vs. long-term bets\n\n"
        f"Write in professional strategy consulting style with markdown formatting."
    )

    try:
        report = await claude_client.analyze(prompt, max_tokens=8192)
    except Exception as exc:
        logger.error("generate_intelligence_report failed: %s", exc)
        report = "Error generating intelligence report."

    return {"intelligence_report": report}


async def persist_intelligence(state: AgentState) -> dict[str, Any]:
    """Update digital product current_state/future_state fields + audit log."""
    repository_id = state.get("repository_id")
    current_state_data = state.get("current_state_data", [])
    market_trends = state.get("market_trends", [])
    benchmarks = state.get("competitor_benchmarks", [])
    intelligence_report = state.get("intelligence_report", "")

    try:
        # Update products with market intelligence enriched current/future state
        for benchmark in benchmarks:
            cap_id = benchmark.get("capability_id")
            if not cap_id:
                continue
            future_state_summary = (
                f"Target maturity: {benchmark.get('industry_benchmark', 'N/A')}/5. "
                f"Position: {benchmark.get('competitive_position', 'N/A')}. "
                f"Investments: {', '.join(benchmark.get('recommended_investments', []))}"
            )
            current_state_summary = (
                f"Current maturity: {benchmark.get('current_maturity', 'N/A')}/5. "
                f"Gap: {benchmark.get('gap_description', 'N/A')}"
            )
            # Update the product that owns this capability
            await db_pool.execute(
                """
                UPDATE digital_products
                SET current_state = $1, future_state = $2, updated_at = NOW()
                WHERE id = (SELECT digital_product_id FROM digital_capabilities WHERE id = $3)
                  AND (current_state IS NULL OR current_state = '')
                """,
                current_state_summary,
                future_state_summary,
                cap_id,
            )

        # Build audit chain
        previous_hash: str | None = None

        trends_payload = {
            "action": "MARKET_TRENDS_ANALYZED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "trends_count": len(market_trends),
        }
        trends_hash = compute_payload_hash(trends_payload, previous_hash)
        audit_id_1 = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO audit_logs (
                id, action, entity_type, entity_id, actor,
                payload, payload_hash, previous_hash, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
            """,
            audit_id_1,
            "MARKET_TRENDS_ANALYZED",
            "AgentExecution",
            repository_id or audit_id_1,
            "market-intelligence-agent",
            json.dumps(trends_payload, default=str),
            trends_hash,
            previous_hash,
        )
        previous_hash = trends_hash

        benchmarks_payload = {
            "action": "COMPETITORS_BENCHMARKED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "benchmarks_count": len(benchmarks),
        }
        benchmarks_hash = compute_payload_hash(benchmarks_payload, previous_hash)
        audit_id_2 = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO audit_logs (
                id, action, entity_type, entity_id, actor,
                payload, payload_hash, previous_hash, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
            """,
            audit_id_2,
            "COMPETITORS_BENCHMARKED",
            "AgentExecution",
            repository_id or audit_id_2,
            "market-intelligence-agent",
            json.dumps(benchmarks_payload, default=str),
            benchmarks_hash,
            previous_hash,
        )
        previous_hash = benchmarks_hash

        report_payload = {
            "action": "INTELLIGENCE_REPORT_GENERATED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "report_length": len(intelligence_report),
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
            "INTELLIGENCE_REPORT_GENERATED",
            "AgentExecution",
            repository_id or audit_id_3,
            "market-intelligence-agent",
            json.dumps(report_payload, default=str),
            report_hash,
            previous_hash,
        )

        logger.info(
            "Market intelligence results persisted: %d trends, %d benchmarks",
            len(market_trends),
            len(benchmarks),
        )
    except Exception as exc:
        logger.error("persist_intelligence failed: %s", exc)
        return {"error": str(exc)}

    return {
        "results": {
            "repository_id": repository_id,
            "market_trends_count": len(market_trends),
            "competitor_benchmarks_count": len(benchmarks),
            "intelligence_report_generated": bool(intelligence_report),
        }
    }


# ---------------------------------------------------------------------------
# Build the LangGraph StateGraph
# ---------------------------------------------------------------------------

graph = StateGraph(AgentState)

graph.add_node("load_current_state", load_current_state)
graph.add_node("analyze_market_trends", analyze_market_trends)
graph.add_node("benchmark_competitors", benchmark_competitors)
graph.add_node("generate_intelligence_report", generate_intelligence_report)
graph.add_node("persist_intelligence", persist_intelligence)

graph.set_entry_point("load_current_state")
graph.add_edge("load_current_state", "analyze_market_trends")
graph.add_edge("analyze_market_trends", "benchmark_competitors")
graph.add_edge("benchmark_competitors", "generate_intelligence_report")
graph.add_edge("generate_intelligence_report", "persist_intelligence")
graph.set_finish_point("persist_intelligence")

compiled_graph = graph.compile()


# ---------------------------------------------------------------------------
# Agent class
# ---------------------------------------------------------------------------


class MarketIntelligenceAgent(BaseAgent):
    def get_name(self) -> str:
        return "market_intelligence"

    async def run(self, input_data: dict[str, Any]) -> dict[str, Any]:
        logger.info("MarketIntelligenceAgent starting with input keys: %s", list(input_data.keys()))
        initial_state: AgentState = {"input_data": input_data}

        try:
            final_state = await compiled_graph.ainvoke(initial_state)
        except Exception as exc:
            logger.error("MarketIntelligenceAgent execution failed: %s", exc)
            return {"error": str(exc)}

        return final_state.get("results", {"error": final_state.get("error", "Unknown error")})
