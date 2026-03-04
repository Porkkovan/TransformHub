"""
Model configuration registry for the LLM router.

Maps model names to provider details, model IDs, token costs, and limits.
Per-agent defaults allow fine-grained control over which model each agent uses.
"""

from __future__ import annotations

from typing import Any

# ---------------------------------------------------------------------------
# Model definitions
# ---------------------------------------------------------------------------

MODEL_CONFIGS: dict[str, dict[str, Any]] = {
    # Anthropic models
    "claude-sonnet-4-5": {
        "provider": "anthropic",
        "model_id": "claude-sonnet-4-5-20250929",
        "cost_per_1k_input": 0.003,
        "cost_per_1k_output": 0.015,
        "max_tokens": 8192,
    },
    "claude-opus-4": {
        "provider": "anthropic",
        "model_id": "claude-opus-4-0-20250514",
        "cost_per_1k_input": 0.015,
        "cost_per_1k_output": 0.075,
        "max_tokens": 4096,
    },
    "claude-haiku-3.5": {
        "provider": "anthropic",
        "model_id": "claude-3-5-haiku-20241022",
        "cost_per_1k_input": 0.001,
        "cost_per_1k_output": 0.005,
        "max_tokens": 8192,
    },
    # Azure OpenAI models
    "gpt-4o-azure": {
        "provider": "azure_openai",
        "model_id": "gpt-4o",
        "cost_per_1k_input": 0.005,
        "cost_per_1k_output": 0.015,
        "max_tokens": 4096,
    },
    # OpenAI models
    "gpt-4o": {
        "provider": "openai",
        "model_id": "gpt-4o",
        "cost_per_1k_input": 0.005,
        "cost_per_1k_output": 0.015,
        "max_tokens": 4096,
    },
    "gpt-4o-mini": {
        "provider": "openai",
        "model_id": "gpt-4o-mini",
        "cost_per_1k_input": 0.00015,
        "cost_per_1k_output": 0.0006,
        "max_tokens": 16384,
    },
    # Google models
    "gemini-2.0-flash": {
        "provider": "google",
        "model_id": "gemini-2.0-flash",
        "cost_per_1k_input": 0.00035,
        "cost_per_1k_output": 0.0015,
        "max_tokens": 8192,
    },
    "gemini-2.5-pro": {
        "provider": "google",
        "model_id": "gemini-2.5-pro-preview-05-06",
        "cost_per_1k_input": 0.00125,
        "cost_per_1k_output": 0.01,
        "max_tokens": 8192,
    },
}

# ---------------------------------------------------------------------------
# Per-agent default models
# ---------------------------------------------------------------------------

AGENT_MODEL_DEFAULTS: dict[str, str] = {
    "discovery": "gpt-4o-azure",
    "lean_vsm": "gpt-4o-azure",
    "risk_compliance": "gpt-4o-azure",
    "architecture": "gpt-4o-azure",
    "fiduciary": "gpt-4o-azure",
    "market_intelligence": "gpt-4o-azure",
    "data_governance": "gpt-4o-azure",
    "product_transformation": "gpt-4o-azure",
    "backlog_okr": "gpt-4o-azure",
    "future_state_vision": "gpt-4o-azure",
    "skill_gap": "gpt-4o-azure",
    "security": "gpt-4o-azure",
    "monitoring": "gpt-4o-azure",
    "documentation": "gpt-4o-azure",
    "change_impact": "gpt-4o-azure",
    "cost_estimation": "gpt-4o-azure",
    "testing_validation": "gpt-4o-azure",
    "git_integration": "gpt-4o-azure",
}

# The default model when no agent-specific override is configured
DEFAULT_MODEL = "gpt-4o-azure"


def get_model_config(model_name: str) -> dict[str, Any]:
    """Return the config dict for *model_name*, or raise ``KeyError``."""
    if model_name not in MODEL_CONFIGS:
        raise KeyError(
            f"Unknown model '{model_name}'. "
            f"Available models: {', '.join(MODEL_CONFIGS.keys())}"
        )
    return MODEL_CONFIGS[model_name]


def get_agent_default_model(agent_type: str) -> str:
    """Return the preferred model name for a given agent type."""
    return AGENT_MODEL_DEFAULTS.get(agent_type, DEFAULT_MODEL)
