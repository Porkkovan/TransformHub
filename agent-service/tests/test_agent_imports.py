"""Verify all agents import, register, and have correct structure."""

import pytest
import asyncio

from app.agents.base import AgentState, BaseAgent
from app.agents.orchestrator import AGENT_REGISTRY


# ── Registry tests ──────────────────────────────────────────────────────────

EXPECTED_AGENTS = sorted([
    "architecture",
    "backlog_okr",
    "change_impact",
    "cost_estimation",
    "data_governance",
    "discovery",
    "documentation",
    "fiduciary",
    "future_state_vision",
    "git_integration",
    "lean_vsm",
    "market_intelligence",
    "monitoring",
    "product_transformation",
    "risk_compliance",
    "security",
    "skill_gap",
    "testing_validation",
])


def test_registry_has_all_agents():
    assert sorted(AGENT_REGISTRY.keys()) == EXPECTED_AGENTS


@pytest.mark.parametrize("agent_type", EXPECTED_AGENTS)
def test_agent_class_extends_base(agent_type):
    cls = AGENT_REGISTRY[agent_type]
    assert issubclass(cls, BaseAgent)


@pytest.mark.parametrize("agent_type", EXPECTED_AGENTS)
def test_agent_has_get_name(agent_type):
    agent = AGENT_REGISTRY[agent_type]()
    name = agent.get_name()
    assert isinstance(name, str)
    assert len(name) > 0


@pytest.mark.parametrize("agent_type", EXPECTED_AGENTS)
def test_agent_run_is_coroutine(agent_type):
    agent = AGENT_REGISTRY[agent_type]()
    assert asyncio.iscoroutinefunction(agent.run)
