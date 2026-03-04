import json
import logging
from datetime import datetime, timezone
from typing import Any

from langgraph.graph import StateGraph, END

from app.agents.base import AgentState, BaseAgent
from app.agents.org_context import format_context_section
from app.services.claude_client import claude_client

logger = logging.getLogger(__name__)


async def load_hierarchy(state: AgentState) -> dict:
    input_data = state["input_data"]
    ctx = format_context_section(input_data)
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Map the BMAD hierarchy and identify all entities that could be impacted by changes:\n\n{json.dumps(input_data, default=str)}\n{ctx}",
            system="You are a change management expert. Return JSON with keys: entities (array of {id, name, type, dependencies}), dependency_graph.",
        )
        hierarchy = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("load_hierarchy failed: %s", exc)
        hierarchy = {"entities": [], "dependency_graph": {}, "error": str(exc)}
    return {"results": {**state.get("results", {}), "hierarchy": hierarchy}}


async def identify_changes(state: AgentState) -> dict:
    input_data = state["input_data"]
    hierarchy = state.get("results", {}).get("hierarchy", {})
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Identify all proposed changes and their direct impacts:\n\nInput: {json.dumps(input_data, default=str)}\nHierarchy: {json.dumps(hierarchy, default=str)}",
            system="You are a change impact analyst. Return JSON with keys: changes (array of {id, description, type, affected_entities, direct_impact_level}).",
        )
        changes = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("identify_changes failed: %s", exc)
        changes = {"changes": [], "error": str(exc)}
    return {"results": {**state.get("results", {}), "changes": changes}}


async def trace_ripple_effects(state: AgentState) -> dict:
    changes = state.get("results", {}).get("changes", {})
    hierarchy = state.get("results", {}).get("hierarchy", {})
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Traverse the dependency graph to identify downstream ripple effects for each change:\n\nChanges: {json.dumps(changes, default=str)}\nHierarchy: {json.dumps(hierarchy, default=str)}",
            system="You are a systems analyst. Return JSON with keys: ripple_effects (array of {change_id, downstream_impacts (array), total_affected_count, max_depth}), impact_heatmap.",
        )
        ripple = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("trace_ripple_effects failed: %s", exc)
        ripple = {"ripple_effects": [], "impact_heatmap": {}, "error": str(exc)}
    return {"results": {**state.get("results", {}), "ripple_effects": ripple}}


async def assess_risk(state: AgentState) -> dict:
    ripple = state.get("results", {}).get("ripple_effects", {})
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Assess the risk of each ripple effect chain and recommend mitigations:\n\n{json.dumps(ripple, default=str)}",
            system="You are a risk analyst. Return JSON with keys: risk_assessment (array of {change_id, risk_level, risk_score, mitigations}), overall_risk_score.",
        )
        risk = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("assess_risk failed: %s", exc)
        risk = {"risk_assessment": [], "overall_risk_score": 0, "error": str(exc)}
    return {"results": {**state.get("results", {}), "risk_assessment": risk}}


async def generate_report(state: AgentState) -> dict:
    results = state.get("results", {})
    try:
        report = await claude_client.analyze(
            prompt=(
                f"Generate a change impact report:\n\n"
                f"Changes: {json.dumps(results.get('changes', {}), default=str)}\n"
                f"Ripple Effects: {json.dumps(results.get('ripple_effects', {}), default=str)}\n"
                f"Risk: {json.dumps(results.get('risk_assessment', {}), default=str)}"
            ),
            system="Provide a structured report with impact summary, dependency visualization descriptions, risk ratings, and recommended sequencing.",
        )
    except Exception as exc:
        logger.error("generate_report failed: %s", exc)
        report = f"Error generating change impact report: {exc}"
    return {"results": {**results, "report": report}}


async def persist_results(state: AgentState) -> dict:
    results = state.get("results", {})
    output = {
        "agent": "change_impact",
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "hierarchy": results.get("hierarchy", {}),
        "changes": results.get("changes", {}),
        "ripple_effects": results.get("ripple_effects", {}),
        "risk_assessment": results.get("risk_assessment", {}),
        "report": results.get("report", ""),
    }
    logger.info("ChangeImpact agent completed with %d result sections", len([k for k in output if k not in ("agent", "completed_at")]))
    return {"results": output}


class ChangeImpactAgent(BaseAgent):
    def get_name(self) -> str:
        return "Change Impact Analysis"

    async def run(self, input_data: dict[str, Any]) -> dict[str, Any]:
        workflow = StateGraph(AgentState)
        workflow.add_node("load_hierarchy", load_hierarchy)
        workflow.add_node("identify_changes", identify_changes)
        workflow.add_node("trace_ripple_effects", trace_ripple_effects)
        workflow.add_node("assess_risk", assess_risk)
        workflow.add_node("generate_report", generate_report)
        workflow.add_node("persist_results", persist_results)

        workflow.set_entry_point("load_hierarchy")
        workflow.add_edge("load_hierarchy", "identify_changes")
        workflow.add_edge("identify_changes", "trace_ripple_effects")
        workflow.add_edge("trace_ripple_effects", "assess_risk")
        workflow.add_edge("assess_risk", "generate_report")
        workflow.add_edge("generate_report", "persist_results")
        workflow.add_edge("persist_results", END)

        compiled = workflow.compile()
        result = await compiled.ainvoke({"input_data": input_data, "results": {}})
        return result.get("results", {})
