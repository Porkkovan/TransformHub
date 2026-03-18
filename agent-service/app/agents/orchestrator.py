import logging
from typing import Any

from app.agents.base import BaseAgent
from app.services.output_validation import validate_or_warn
from app.services.hallucination_detector import detect_hallucinations
from app.agents.discovery.graph import DiscoveryAgent
from app.agents.lean_vsm.graph import LeanVsmAgent
from app.agents.risk_compliance.graph import RiskComplianceAgent
from app.agents.fiduciary.graph import FiduciaryAgent
from app.agents.market_intelligence.graph import MarketIntelligenceAgent
from app.agents.architecture.graph import ArchitectureAgent
from app.agents.data_governance.graph import DataGovernanceAgent
from app.agents.product_transformation.graph import ProductTransformationAgent
from app.agents.backlog_okr.graph import BacklogOkrAgent
from app.agents.future_state_vision.graph import FutureStateVisionAgent
from app.agents.git_integration.graph import GitIntegrationAgent
from app.agents.testing_validation.graph import TestingValidationAgent
from app.agents.cost_estimation.graph import CostEstimationAgent
from app.agents.change_impact.graph import ChangeImpactAgent
from app.agents.documentation.graph import DocumentationAgent
from app.agents.monitoring.graph import MonitoringAgent
from app.agents.security.graph import SecurityAgent
from app.agents.skill_gap.graph import SkillGapAgent

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Agent registry: maps agent_type string -> agent class
# ---------------------------------------------------------------------------

AGENT_REGISTRY: dict[str, type[BaseAgent]] = {
    "discovery": DiscoveryAgent,
    "lean_vsm": LeanVsmAgent,
    "risk_compliance": RiskComplianceAgent,
    "fiduciary": FiduciaryAgent,
    "market_intelligence": MarketIntelligenceAgent,
    "architecture": ArchitectureAgent,
    "data_governance": DataGovernanceAgent,
    "product_transformation": ProductTransformationAgent,
    "backlog_okr": BacklogOkrAgent,
    "future_state_vision": FutureStateVisionAgent,
    "git_integration": GitIntegrationAgent,
    "testing_validation": TestingValidationAgent,
    "cost_estimation": CostEstimationAgent,
    "change_impact": ChangeImpactAgent,
    "documentation": DocumentationAgent,
    "monitoring": MonitoringAgent,
    "security": SecurityAgent,
    "skill_gap": SkillGapAgent,
}


async def run_agent(agent_type: str, input_data: dict[str, Any]) -> dict[str, Any]:
    """Look up the agent by type, instantiate it, and invoke run()."""
    agent_class = AGENT_REGISTRY.get(agent_type)

    if agent_class is None:
        available = ", ".join(sorted(AGENT_REGISTRY.keys()))
        error_msg = f"Unknown agent type '{agent_type}'. Available agents: {available}"
        logger.error(error_msg)
        return {"error": error_msg}

    agent = agent_class()
    logger.info("Running agent '%s' (%s)", agent.get_name(), agent_class.__name__)

    try:
        result = await agent.run(input_data)
    except NotImplementedError as exc:
        logger.warning("Agent '%s' not implemented: %s", agent_type, exc)
        return {"error": str(exc)}
    except Exception as exc:
        logger.error("Agent '%s' failed: %s", agent_type, exc, exc_info=True)
        return {"error": str(exc)}

    # P1: Validate output schema; inject warnings if contract violated
    if isinstance(result, dict) and "error" not in result:
        result = validate_or_warn(agent_type, result)

    # P4: Hallucination detection — runs after validation, advisory only
    if isinstance(result, dict) and "error" not in result:
        result = detect_hallucinations(agent_type, result)
        flags = result.get("_hallucination_flags", {})
        if flags.get("critical", 0) > 0:
            logger.warning(
                "Agent '%s' output has %d critical hallucination flag(s): %s",
                agent_type,
                flags["critical"],
                [f["reason"] for f in flags.get("flags", []) if f["severity"] == "critical"],
            )

    return result
