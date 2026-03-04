import json
import logging
from datetime import datetime, timezone
from typing import Any

from langgraph.graph import StateGraph, END

from app.agents.base import AgentState, BaseAgent
from app.agents.org_context import format_context_section
from app.services.claude_client import claude_client

logger = logging.getLogger(__name__)


async def analyze_scope(state: AgentState) -> dict:
    input_data = state["input_data"]
    ctx = format_context_section(input_data)
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Analyze the transformation scope and identify cost categories (cloud infrastructure, licensing, development effort, training, migration):\n\n{json.dumps(input_data, default=str)}\n{ctx}",
            system="You are a cost estimation expert. Return JSON with keys: scope_summary, cost_categories, complexity_rating (low|medium|high|very_high).",
        )
        scope = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("analyze_scope failed: %s", exc)
        scope = {"scope_summary": "Error during analysis", "cost_categories": [], "complexity_rating": "unknown", "error": str(exc)}
    return {"results": {**state.get("results", {}), "scope_analysis": scope}}


async def estimate_cloud_costs(state: AgentState) -> dict:
    scope = state.get("results", {}).get("scope_analysis", {})
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Based on the scope, estimate cloud infrastructure costs (compute, storage, networking, managed services). Provide monthly and annual projections:\n\n{json.dumps(scope, default=str)}",
            system="You are a cloud cost analyst. Return JSON with keys: monthly_estimate, annual_estimate, breakdown (array of {category, monthly_cost, notes}), assumptions.",
        )
        costs = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("estimate_cloud_costs failed: %s", exc)
        costs = {"monthly_estimate": 0, "annual_estimate": 0, "breakdown": [], "assumptions": [], "error": str(exc)}
    return {"results": {**state.get("results", {}), "cloud_costs": costs}}


async def estimate_effort(state: AgentState) -> dict:
    scope = state.get("results", {}).get("scope_analysis", {})
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Estimate development effort, team composition, and timeline:\n\n{json.dumps(scope, default=str)}",
            system="You are a project estimation expert. Return JSON with keys: total_person_months, team_composition (array), timeline_months, effort_breakdown (array of {phase, person_months, cost_estimate}).",
        )
        effort = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("estimate_effort failed: %s", exc)
        effort = {"total_person_months": 0, "team_composition": [], "timeline_months": 0, "effort_breakdown": [], "error": str(exc)}
    return {"results": {**state.get("results", {}), "effort_estimate": effort}}


async def estimate_licensing(state: AgentState) -> dict:
    scope = state.get("results", {}).get("scope_analysis", {})
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Estimate software licensing costs for tools, platforms, and third-party services:\n\n{json.dumps(scope, default=str)}",
            system="You are a software licensing analyst. Return JSON with keys: annual_licensing_cost, licenses (array of {name, type, annual_cost, notes}).",
        )
        licensing = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("estimate_licensing failed: %s", exc)
        licensing = {"annual_licensing_cost": 0, "licenses": [], "error": str(exc)}
    return {"results": {**state.get("results", {}), "licensing_costs": licensing}}


async def calculate_roi(state: AgentState) -> dict:
    results = state.get("results", {})
    try:
        raw = await claude_client.analyze_structured(
            prompt=(
                f"Calculate ROI based on all cost estimates. Include payback period and 3-year TCO:\n\n"
                f"Cloud: {json.dumps(results.get('cloud_costs', {}), default=str)}\n"
                f"Effort: {json.dumps(results.get('effort_estimate', {}), default=str)}\n"
                f"Licensing: {json.dumps(results.get('licensing_costs', {}), default=str)}"
            ),
            system="You are a financial analyst. Return JSON with keys: total_investment, annual_savings_estimate, payback_period_months, three_year_tco, three_year_roi_percentage, recommendation.",
        )
        roi = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("calculate_roi failed: %s", exc)
        roi = {"total_investment": 0, "annual_savings_estimate": 0, "payback_period_months": 0, "three_year_tco": 0, "three_year_roi_percentage": 0, "recommendation": "Error during analysis", "error": str(exc)}
    return {"results": {**results, "roi_analysis": roi}}


async def persist_results(state: AgentState) -> dict:
    results = state.get("results", {})
    output = {
        "agent": "cost_estimation",
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "scope_analysis": results.get("scope_analysis", {}),
        "cloud_costs": results.get("cloud_costs", {}),
        "effort_estimate": results.get("effort_estimate", {}),
        "licensing_costs": results.get("licensing_costs", {}),
        "roi_analysis": results.get("roi_analysis", {}),
    }
    logger.info("CostEstimation agent completed with %d result sections", len([k for k in output if k not in ("agent", "completed_at")]))
    return {"results": output}


class CostEstimationAgent(BaseAgent):
    def get_name(self) -> str:
        return "Cost Estimation"

    async def run(self, input_data: dict[str, Any]) -> dict[str, Any]:
        workflow = StateGraph(AgentState)
        workflow.add_node("analyze_scope", analyze_scope)
        workflow.add_node("estimate_cloud_costs", estimate_cloud_costs)
        workflow.add_node("estimate_effort", estimate_effort)
        workflow.add_node("estimate_licensing", estimate_licensing)
        workflow.add_node("calculate_roi", calculate_roi)
        workflow.add_node("persist_results", persist_results)

        workflow.set_entry_point("analyze_scope")
        workflow.add_edge("analyze_scope", "estimate_cloud_costs")
        workflow.add_edge("estimate_cloud_costs", "estimate_effort")
        workflow.add_edge("estimate_effort", "estimate_licensing")
        workflow.add_edge("estimate_licensing", "calculate_roi")
        workflow.add_edge("calculate_roi", "persist_results")
        workflow.add_edge("persist_results", END)

        compiled = workflow.compile()
        result = await compiled.ainvoke({"input_data": input_data, "results": {}})
        return result.get("results", {})
