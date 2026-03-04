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
            prompt=f"Analyze the codebase and transformation context to identify documentation needs:\n\n{json.dumps(input_data, default=str)}\n{ctx}",
            system="You are a technical writing expert. Return JSON with keys: doc_types_needed (array), existing_docs, gaps, priority_order.",
        )
        context = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("gather_context failed: %s", exc)
        context = {"doc_types_needed": [], "existing_docs": [], "gaps": [], "priority_order": [], "error": str(exc)}
    return {"results": {**state.get("results", {}), "doc_context": context}}


async def generate_api_docs(state: AgentState) -> dict:
    input_data = state["input_data"]
    try:
        api_docs = await claude_client.analyze(
            prompt=f"Generate comprehensive API documentation based on the codebase context:\n\n{json.dumps(input_data, default=str)}",
            system="You are an API documentation expert. Generate OpenAPI-style documentation with endpoints, request/response schemas, authentication, and examples.",
        )
    except Exception as exc:
        logger.error("generate_api_docs failed: %s", exc)
        api_docs = f"Error generating API documentation: {exc}"
    return {"results": {**state.get("results", {}), "api_docs": api_docs}}


async def generate_runbooks(state: AgentState) -> dict:
    input_data = state["input_data"]
    try:
        runbooks = await claude_client.analyze(
            prompt=f"Generate operational runbooks for deployment, monitoring, and incident response:\n\n{json.dumps(input_data, default=str)}",
            system="You are a DevOps documentation expert. Create runbooks with step-by-step procedures, troubleshooting guides, and escalation paths.",
        )
    except Exception as exc:
        logger.error("generate_runbooks failed: %s", exc)
        runbooks = f"Error generating runbooks: {exc}"
    return {"results": {**state.get("results", {}), "runbooks": runbooks}}


async def generate_adrs(state: AgentState) -> dict:
    input_data = state["input_data"]
    try:
        adrs = await claude_client.analyze(
            prompt=f"Generate Architecture Decision Records (ADRs) for key technical decisions:\n\n{json.dumps(input_data, default=str)}",
            system="You are a software architect. Create ADRs following the standard format: Title, Status, Context, Decision, Consequences.",
        )
    except Exception as exc:
        logger.error("generate_adrs failed: %s", exc)
        adrs = f"Error generating ADRs: {exc}"
    return {"results": {**state.get("results", {}), "adrs": adrs}}


async def generate_onboarding(state: AgentState) -> dict:
    results = state.get("results", {})
    try:
        onboarding = await claude_client.analyze(
            prompt=f"Generate developer onboarding documentation:\n\nAPI Docs: {str(results.get('api_docs', ''))[:1000]}\nRunbooks: {str(results.get('runbooks', ''))[:1000]}",
            system="You are a developer experience expert. Create onboarding guides covering setup, architecture overview, key workflows, and contribution guidelines.",
        )
    except Exception as exc:
        logger.error("generate_onboarding failed: %s", exc)
        onboarding = f"Error generating onboarding guide: {exc}"
    return {"results": {**results, "onboarding_guide": onboarding}}


async def persist_results(state: AgentState) -> dict:
    results = state.get("results", {})
    output = {
        "agent": "documentation",
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "doc_context": results.get("doc_context", {}),
        "api_docs": results.get("api_docs", ""),
        "runbooks": results.get("runbooks", ""),
        "adrs": results.get("adrs", ""),
        "onboarding_guide": results.get("onboarding_guide", ""),
    }
    logger.info("Documentation agent completed with %d result sections", len([k for k in output if k not in ("agent", "completed_at")]))
    return {"results": output}


class DocumentationAgent(BaseAgent):
    def get_name(self) -> str:
        return "Documentation Generator"

    async def run(self, input_data: dict[str, Any]) -> dict[str, Any]:
        workflow = StateGraph(AgentState)
        workflow.add_node("gather_context", gather_context)
        workflow.add_node("generate_api_docs", generate_api_docs)
        workflow.add_node("generate_runbooks", generate_runbooks)
        workflow.add_node("generate_adrs", generate_adrs)
        workflow.add_node("generate_onboarding", generate_onboarding)
        workflow.add_node("persist_results", persist_results)

        workflow.set_entry_point("gather_context")
        workflow.add_edge("gather_context", "generate_api_docs")
        workflow.add_edge("generate_api_docs", "generate_runbooks")
        workflow.add_edge("generate_runbooks", "generate_adrs")
        workflow.add_edge("generate_adrs", "generate_onboarding")
        workflow.add_edge("generate_onboarding", "persist_results")
        workflow.add_edge("persist_results", END)

        compiled = workflow.compile()
        result = await compiled.ainvoke({"input_data": input_data, "results": {}})
        return result.get("results", {})
