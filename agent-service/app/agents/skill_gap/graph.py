import json
import logging
from datetime import datetime, timezone
from typing import Any

from langgraph.graph import StateGraph, END

from app.agents.base import AgentState, BaseAgent
from app.agents.org_context import format_context_section
from app.services.claude_client import claude_client

logger = logging.getLogger(__name__)


async def assess_current_skills(state: AgentState) -> dict:
    input_data = state["input_data"]
    ctx = format_context_section(input_data)
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Assess current team skills based on the existing tech stack and codebase:\n\n{json.dumps(input_data, default=str)}\n{ctx}",
            system="You are a technical skills assessor. Return JSON with keys: current_skills (array of {skill, category, proficiency_level (1-5), team_coverage_percent}), skill_categories.",
        )
        skills = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("assess_current_skills failed: %s", exc)
        skills = {"current_skills": [], "skill_categories": [], "error": str(exc)}
    return {"results": {**state.get("results", {}), "current_skills": skills}}


async def define_future_requirements(state: AgentState) -> dict:
    input_data = state["input_data"]
    current = state.get("results", {}).get("current_skills", {})
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Define future skill requirements based on the transformation target state:\n\nCurrent: {json.dumps(current, default=str)}\nTarget: {json.dumps(input_data, default=str)}",
            system="You are a workforce planning expert. Return JSON with keys: required_skills (array of {skill, category, required_level (1-5), priority (critical|high|medium|low)}), new_roles_needed.",
        )
        future = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("define_future_requirements failed: %s", exc)
        future = {"required_skills": [], "new_roles_needed": [], "error": str(exc)}
    return {"results": {**state.get("results", {}), "future_requirements": future}}


async def identify_gaps(state: AgentState) -> dict:
    current = state.get("results", {}).get("current_skills", {})
    future = state.get("results", {}).get("future_requirements", {})
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Identify skill gaps between current capabilities and future requirements:\n\nCurrent: {json.dumps(current, default=str)}\nFuture: {json.dumps(future, default=str)}",
            system="You are a gap analysis expert. Return JSON with keys: gaps (array of {skill, current_level, required_level, gap_size, impact, urgency}), critical_gaps_count, overall_readiness_score (0-100).",
        )
        gaps = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("identify_gaps failed: %s", exc)
        gaps = {"gaps": [], "critical_gaps_count": 0, "overall_readiness_score": 0, "error": str(exc)}
    return {"results": {**state.get("results", {}), "skill_gaps": gaps}}


async def create_training_paths(state: AgentState) -> dict:
    gaps = state.get("results", {}).get("skill_gaps", {})
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Create training and upskilling paths to close the identified gaps:\n\n{json.dumps(gaps, default=str)}",
            system="You are a learning and development expert. Return JSON with keys: training_paths (array of {skill, resources (array), estimated_duration_weeks, cost_estimate, delivery_method}), recommended_certifications.",
        )
        paths = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("create_training_paths failed: %s", exc)
        paths = {"training_paths": [], "recommended_certifications": [], "error": str(exc)}
    return {"results": {**state.get("results", {}), "training_paths": paths}}


async def recommend_hiring(state: AgentState) -> dict:
    gaps = state.get("results", {}).get("skill_gaps", {})
    paths = state.get("results", {}).get("training_paths", {})
    try:
        raw = await claude_client.analyze_structured(
            prompt=f"Recommend hiring strategy for gaps that can't be filled by training alone:\n\nGaps: {json.dumps(gaps, default=str)}\nTraining Paths: {json.dumps(paths, default=str)}",
            system="You are a talent acquisition strategist. Return JSON with keys: hiring_recommendations (array of {role, skills, seniority, priority, estimated_time_to_hire_weeks}), build_vs_buy_analysis.",
        )
        hiring = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("recommend_hiring failed: %s", exc)
        hiring = {"hiring_recommendations": [], "build_vs_buy_analysis": "", "error": str(exc)}
    return {"results": {**state.get("results", {}), "hiring_recommendations": hiring}}


async def persist_results(state: AgentState) -> dict:
    results = state.get("results", {})
    output = {
        "agent": "skill_gap",
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "current_skills": results.get("current_skills", {}),
        "future_requirements": results.get("future_requirements", {}),
        "skill_gaps": results.get("skill_gaps", {}),
        "training_paths": results.get("training_paths", {}),
        "hiring_recommendations": results.get("hiring_recommendations", {}),
    }
    logger.info("SkillGap agent completed with %d result sections", len([k for k in output if k not in ("agent", "completed_at")]))
    return {"results": output}


class SkillGapAgent(BaseAgent):
    def get_name(self) -> str:
        return "Team Skill Gap"

    async def run(self, input_data: dict[str, Any]) -> dict[str, Any]:
        workflow = StateGraph(AgentState)
        workflow.add_node("assess_current_skills", assess_current_skills)
        workflow.add_node("define_future_requirements", define_future_requirements)
        workflow.add_node("identify_gaps", identify_gaps)
        workflow.add_node("create_training_paths", create_training_paths)
        workflow.add_node("recommend_hiring", recommend_hiring)
        workflow.add_node("persist_results", persist_results)

        workflow.set_entry_point("assess_current_skills")
        workflow.add_edge("assess_current_skills", "define_future_requirements")
        workflow.add_edge("define_future_requirements", "identify_gaps")
        workflow.add_edge("identify_gaps", "create_training_paths")
        workflow.add_edge("create_training_paths", "recommend_hiring")
        workflow.add_edge("recommend_hiring", "persist_results")
        workflow.add_edge("persist_results", END)

        compiled = workflow.compile()
        result = await compiled.ainvoke({"input_data": input_data, "results": {}})
        return result.get("results", {})
