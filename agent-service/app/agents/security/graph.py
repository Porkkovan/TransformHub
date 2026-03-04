import json
import logging
from datetime import datetime, timezone
from typing import Any

from langgraph.graph import StateGraph, END

from app.agents.base import AgentState, BaseAgent
from app.agents.org_context import format_context_section
from app.services.claude_client import claude_client

logger = logging.getLogger(__name__)


async def scan_dependencies(state: AgentState) -> dict:
    input_data = state["input_data"]
    ctx = format_context_section(input_data)
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Analyze dependency files for known vulnerabilities and outdated packages:\n\n{json.dumps(input_data, default=str)}\n{ctx}",
            system="You are a security scanning expert. Return JSON with keys: vulnerabilities (array of {package, version, severity, cve_id, description, fix_version}), total_deps, vulnerable_count.",
        )
        deps = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("scan_dependencies failed: %s", exc)
        deps = {"vulnerabilities": [], "total_deps": 0, "vulnerable_count": 0, "error": str(exc)}
    return {"results": {**state.get("results", {}), "dependency_scan": deps}}


async def analyze_code_patterns(state: AgentState) -> dict:
    input_data = state["input_data"]
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Identify security anti-patterns in the codebase (SQL injection, XSS, hardcoded secrets, insecure crypto, etc.):\n\n{json.dumps(input_data, default=str)}",
            system="You are a code security analyst. Return JSON with keys: findings (array of {pattern, severity, file, line_hint, description, remediation}), risk_score (0-100).",
        )
        patterns = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("analyze_code_patterns failed: %s", exc)
        patterns = {"findings": [], "risk_score": 0, "error": str(exc)}
    return {"results": {**state.get("results", {}), "code_analysis": patterns}}


async def check_cves(state: AgentState) -> dict:
    dep_scan = state.get("results", {}).get("dependency_scan", {})
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Cross-reference identified vulnerabilities with CVE databases and provide detailed remediation guidance:\n\n{json.dumps(dep_scan, default=str)}",
            system="You are a CVE analyst. Return JSON with keys: cve_details (array of {cve_id, cvss_score, exploit_available, remediation_priority, patch_available}), critical_count, high_count.",
        )
        cves = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("check_cves failed: %s", exc)
        cves = {"cve_details": [], "critical_count": 0, "high_count": 0, "error": str(exc)}
    return {"results": {**state.get("results", {}), "cve_analysis": cves}}


async def assess_posture(state: AgentState) -> dict:
    results = state.get("results", {})
    try:
        raw = await claude_client.analyze_structured(
            prompt=(
                f"Assess overall security posture:\n\n"
                f"Dependency scan: {json.dumps(results.get('dependency_scan', {}), default=str)}\n"
                f"Code analysis: {json.dumps(results.get('code_analysis', {}), default=str)}\n"
                f"CVE analysis: {json.dumps(results.get('cve_analysis', {}), default=str)}"
            ),
            system="You are a CISO advisor. Return JSON with keys: posture_score (0-100), grade (A-F), strengths (array), weaknesses (array), compliance_gaps (array).",
        )
        posture = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("assess_posture failed: %s", exc)
        posture = {"posture_score": 0, "grade": "F", "strengths": [], "weaknesses": [], "compliance_gaps": [], "error": str(exc)}
    return {"results": {**results, "security_posture": posture}}


async def generate_remediation_plan(state: AgentState) -> dict:
    results = state.get("results", {})
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Generate prioritized remediation plan:\n\n{json.dumps(results.get('security_posture', {}), default=str)}",
            system="You are a security remediation expert. Return JSON with keys: immediate_actions (array), short_term (array), long_term (array), estimated_effort_hours.",
        )
        plan = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("generate_remediation_plan failed: %s", exc)
        plan = {"immediate_actions": [], "short_term": [], "long_term": [], "estimated_effort_hours": 0, "error": str(exc)}
    return {"results": {**results, "remediation_plan": plan}}


async def persist_results(state: AgentState) -> dict:
    results = state.get("results", {})
    output = {
        "agent": "security",
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "dependency_scan": results.get("dependency_scan", {}),
        "code_analysis": results.get("code_analysis", {}),
        "cve_analysis": results.get("cve_analysis", {}),
        "security_posture": results.get("security_posture", {}),
        "remediation_plan": results.get("remediation_plan", {}),
    }
    logger.info("Security agent completed with %d result sections", len([k for k in output if k not in ("agent", "completed_at")]))
    return {"results": output}


class SecurityAgent(BaseAgent):
    def get_name(self) -> str:
        return "Security Vulnerability"

    async def run(self, input_data: dict[str, Any]) -> dict[str, Any]:
        workflow = StateGraph(AgentState)
        workflow.add_node("scan_dependencies", scan_dependencies)
        workflow.add_node("analyze_code_patterns", analyze_code_patterns)
        workflow.add_node("check_cves", check_cves)
        workflow.add_node("assess_posture", assess_posture)
        workflow.add_node("generate_remediation_plan", generate_remediation_plan)
        workflow.add_node("persist_results", persist_results)

        workflow.set_entry_point("scan_dependencies")
        workflow.add_edge("scan_dependencies", "analyze_code_patterns")
        workflow.add_edge("analyze_code_patterns", "check_cves")
        workflow.add_edge("check_cves", "assess_posture")
        workflow.add_edge("assess_posture", "generate_remediation_plan")
        workflow.add_edge("generate_remediation_plan", "persist_results")
        workflow.add_edge("persist_results", END)

        compiled = workflow.compile()
        result = await compiled.ainvoke({"input_data": input_data, "results": {}})
        return result.get("results", {})
