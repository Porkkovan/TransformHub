import json
import logging
from datetime import datetime, timezone
from typing import Any

from langgraph.graph import StateGraph, END

from app.agents.base import AgentState, BaseAgent
from app.agents.org_context import format_context_section
from app.services.claude_client import claude_client

logger = logging.getLogger(__name__)


async def define_kpis(state: AgentState) -> dict:
    input_data = state["input_data"]
    ctx = format_context_section(input_data)
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Define KPI baselines and monitoring targets for the transformation:\n\n{json.dumps(input_data, default=str)}\n{ctx}",
            system="You are a KPI and metrics expert. Return JSON with keys: kpis (array of {name, category, baseline, target, unit, measurement_frequency}).",
        )
        kpis = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("define_kpis failed: %s", exc)
        kpis = {"kpis": [], "error": str(exc)}
    return {"results": {**state.get("results", {}), "kpis": kpis}}


async def detect_drift(state: AgentState) -> dict:
    kpis = state.get("results", {}).get("kpis", {})
    input_data = state["input_data"]
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Analyze current metrics against baselines and detect drift:\n\nKPIs: {json.dumps(kpis, default=str)}\nCurrent Data: {json.dumps(input_data, default=str)}",
            system="You are a monitoring analyst. Return JSON with keys: drift_detected (array of {kpi_name, current_value, baseline, drift_percentage, severity}), overall_health_score (0-100).",
        )
        drift = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("detect_drift failed: %s", exc)
        drift = {"drift_detected": [], "overall_health_score": 0, "error": str(exc)}
    return {"results": {**state.get("results", {}), "drift_analysis": drift}}


async def analyze_trends(state: AgentState) -> dict:
    drift = state.get("results", {}).get("drift_analysis", {})
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Analyze trends and predict future trajectory:\n\n{json.dumps(drift, default=str)}",
            system="You are a trend analysis expert. Return JSON with keys: trends (array of {kpi_name, direction, confidence, predicted_value_30d}), alerts (array of {message, severity, recommended_action}).",
        )
        trends = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("analyze_trends failed: %s", exc)
        trends = {"trends": [], "alerts": [], "error": str(exc)}
    return {"results": {**state.get("results", {}), "trend_analysis": trends}}


async def generate_alerts(state: AgentState) -> dict:
    results = state.get("results", {})
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Generate monitoring alerts and recommended actions:\n\nDrift: {json.dumps(results.get('drift_analysis', {}), default=str)}\nTrends: {json.dumps(results.get('trend_analysis', {}), default=str)}",
            system="You are an SRE expert. Return JSON with keys: critical_alerts (array), warning_alerts (array), info_alerts (array), recommended_actions (array).",
        )
        alerts = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("generate_alerts failed: %s", exc)
        alerts = {"critical_alerts": [], "warning_alerts": [], "info_alerts": [], "recommended_actions": [], "error": str(exc)}
    return {"results": {**results, "alerts": alerts}}


async def generate_dashboard_data(state: AgentState) -> dict:
    results = state.get("results", {})
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Compile dashboard data summary:\n\n{json.dumps(results, default=str)}",
            system="Return JSON with keys: health_score, kpi_summary (array), top_alerts, trend_summary.",
        )
        dashboard = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("generate_dashboard_data failed: %s", exc)
        dashboard = {"health_score": 0, "kpi_summary": [], "top_alerts": [], "trend_summary": "", "error": str(exc)}
    return {"results": {**results, "dashboard": dashboard}}


async def persist_results(state: AgentState) -> dict:
    results = state.get("results", {})
    output = {
        "agent": "monitoring",
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "kpis": results.get("kpis", {}),
        "drift_analysis": results.get("drift_analysis", {}),
        "trend_analysis": results.get("trend_analysis", {}),
        "alerts": results.get("alerts", {}),
        "dashboard": results.get("dashboard", {}),
    }
    logger.info("Monitoring agent completed with %d result sections", len([k for k in output if k not in ("agent", "completed_at")]))
    return {"results": output}


class MonitoringAgent(BaseAgent):
    def get_name(self) -> str:
        return "Continuous Monitoring"

    async def run(self, input_data: dict[str, Any]) -> dict[str, Any]:
        workflow = StateGraph(AgentState)
        workflow.add_node("define_kpis", define_kpis)
        workflow.add_node("detect_drift", detect_drift)
        workflow.add_node("analyze_trends", analyze_trends)
        workflow.add_node("generate_alerts", generate_alerts)
        workflow.add_node("generate_dashboard_data", generate_dashboard_data)
        workflow.add_node("persist_results", persist_results)

        workflow.set_entry_point("define_kpis")
        workflow.add_edge("define_kpis", "detect_drift")
        workflow.add_edge("detect_drift", "analyze_trends")
        workflow.add_edge("analyze_trends", "generate_alerts")
        workflow.add_edge("generate_alerts", "generate_dashboard_data")
        workflow.add_edge("generate_dashboard_data", "persist_results")
        workflow.add_edge("persist_results", END)

        compiled = workflow.compile()
        result = await compiled.ainvoke({"input_data": input_data, "results": {}})
        return result.get("results", {})
