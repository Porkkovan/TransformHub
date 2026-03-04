import json
import logging
from datetime import datetime, timezone
from typing import Any

from langgraph.graph import StateGraph, END

from app.agents.base import AgentState, BaseAgent
from app.agents.org_context import format_context_section
from app.services.claude_client import claude_client

logger = logging.getLogger(__name__)


async def gather_context(state: AgentState) -> dict:
    input_data = state["input_data"]
    ctx = format_context_section(input_data)
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Analyze the following transformation context and identify testable components, integration points, and validation criteria:\n\n{json.dumps(input_data, default=str)}\n{ctx}",
            system="You are a QA and testing expert. Return JSON with keys: testable_components, integration_points, validation_criteria.",
        )
        context = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("gather_context failed: %s", exc)
        context = {"testable_components": [], "integration_points": [], "validation_criteria": [], "error": str(exc)}
    return {"results": {**state.get("results", {}), "test_context": context}}


async def generate_test_cases(state: AgentState) -> dict:
    context = state.get("results", {}).get("test_context", {})
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Based on this context, generate comprehensive test cases covering unit, integration, and E2E scenarios:\n\n{json.dumps(context, default=str)}",
            system="You are a test engineering expert. Return JSON array with keys per case: id, name, type (unit|integration|e2e), description, steps, expected_result, priority (critical|high|medium|low).",
        )
        cases = json.loads(raw)
        if not isinstance(cases, list):
            cases = cases.get("test_cases", cases.get("cases", []))
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("generate_test_cases failed: %s", exc)
        cases = []
    return {"results": {**state.get("results", {}), "test_cases": cases}}


async def validate_plans(state: AgentState) -> dict:
    input_data = state["input_data"]
    test_cases = state.get("results", {}).get("test_cases", [])
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Validate these transformation plans against the test cases. Identify gaps, risks, and recommendations:\n\nPlans: {json.dumps(input_data, default=str)}\n\nTest Cases: {json.dumps(test_cases, default=str)}",
            system="You are a validation expert. Return JSON with keys: validation_status, gaps, risks, recommendations, coverage_score (0-100).",
        )
        validation = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("validate_plans failed: %s", exc)
        validation = {"validation_status": "error", "gaps": [], "risks": [], "recommendations": [], "coverage_score": 0, "error": str(exc)}
    return {"results": {**state.get("results", {}), "validation_results": validation}}


async def generate_report(state: AgentState) -> dict:
    results = state.get("results", {})
    try:
        report = await claude_client.analyze(
            prompt=f"Generate a comprehensive testing and validation report:\n\nTest Cases: {json.dumps(results.get('test_cases', []), default=str)}\n\nValidation: {json.dumps(results.get('validation_results', {}), default=str)}",
            system="You are a QA report writer. Provide a structured report with executive summary, test coverage, findings, and recommendations.",
        )
    except Exception as exc:
        logger.error("generate_report failed: %s", exc)
        report = f"Error generating testing report: {exc}"
    return {"results": {**results, "report": report}}


async def persist_results(state: AgentState) -> dict:
    results = state.get("results", {})
    output = {
        "agent": "testing_validation",
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "test_context": results.get("test_context", {}),
        "test_cases": results.get("test_cases", []),
        "validation_results": results.get("validation_results", {}),
        "report": results.get("report", ""),
    }
    logger.info("TestingValidation agent completed with %d test cases", len(output.get("test_cases", [])))
    return {"results": output}


class TestingValidationAgent(BaseAgent):
    def get_name(self) -> str:
        return "Testing & Validation"

    async def run(self, input_data: dict[str, Any]) -> dict[str, Any]:
        workflow = StateGraph(AgentState)
        workflow.add_node("gather_context", gather_context)
        workflow.add_node("generate_test_cases", generate_test_cases)
        workflow.add_node("validate_plans", validate_plans)
        workflow.add_node("generate_report", generate_report)
        workflow.add_node("persist_results", persist_results)

        workflow.set_entry_point("gather_context")
        workflow.add_edge("gather_context", "generate_test_cases")
        workflow.add_edge("generate_test_cases", "validate_plans")
        workflow.add_edge("validate_plans", "generate_report")
        workflow.add_edge("generate_report", "persist_results")
        workflow.add_edge("persist_results", END)

        compiled = workflow.compile()
        result = await compiled.ainvoke({"input_data": input_data, "results": {}})
        return result.get("results", {})
