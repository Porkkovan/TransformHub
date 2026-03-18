"""
Agent output JSON schema validation with auto-retry on malformed output.

Each agent type has a minimal schema contract. Validation is lightweight
(key presence + type checks) — not a full JSON Schema library — to avoid
import overhead and to allow partial/forward-compatible outputs.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class ValidationError(Exception):
    """Raised when an agent output fails validation and retries are exhausted."""


# ─── Schemas (minimal key presence + type) ───────────────────────────────────

# Each entry: field_path (dot-separated) → expected type | list | callable
_SCHEMAS: dict[str, list[dict]] = {
    "discovery": [
        {"path": "functionalities", "type": list, "required": True},
        {"path": "capabilities",    "type": list, "required": True},
        {"path": "products",        "type": list, "required": True},
    ],
    "lean_vsm": [
        {"path": "capabilities", "type": list, "required": True},
        {"path": "capabilities[0].capability_name", "type": str, "required": False},
        {"path": "capabilities[0].steps",           "type": list, "required": False},
    ],
    "risk_compliance": [
        {"path": "risk_scores", "type": list, "required": True},
    ],
    "architecture": [
        {"path": "current_architecture", "type": dict, "required": True},
    ],
    "future_state_vision": [
        {"path": "future_capabilities",   "type": list, "required": True},
        {"path": "future_value_streams",  "type": list, "required": True},
    ],
    "product_transformation": [
        {"path": "transformation_plan", "type": list, "required": True},
        {"path": "readiness_scores",    "type": list, "required": True},
    ],
    "backlog_okr": [
        {"path": "okrs",            "type": list, "required": True},
        {"path": "backlog_items",   "type": list, "required": True},
    ],
    "market_intelligence": [
        {"path": "intelligence_report", "type": str, "required": True},
    ],
    "fiduciary": [
        {"path": "fiduciary_report", "type": str, "required": True},
    ],
    "data_governance": [
        {"path": "data_classifications", "type": list, "required": True},
    ],
}


def _get_nested(data: Any, path: str) -> tuple[bool, Any]:
    """Traverse dot-separated path; [0] notation for first list element."""
    parts = path.replace("[0]", ".[0]").split(".")
    current = data
    for part in parts:
        if part == "[0]":
            if not isinstance(current, list) or len(current) == 0:
                return False, None
            current = current[0]
        elif isinstance(current, dict):
            if part not in current:
                return False, None
            current = current[part]
        else:
            return False, None
    return True, current


def validate_agent_output(
    agent_type: str,
    output: dict[str, Any],
) -> tuple[bool, list[str]]:
    """
    Validate *output* against the schema for *agent_type*.

    Returns (is_valid, list_of_error_messages).
    If no schema exists for agent_type, returns (True, []).
    """
    schema = _SCHEMAS.get(agent_type)
    if not schema:
        return True, []

    errors: list[str] = []
    for rule in schema:
        path = rule["path"]
        expected_type = rule["type"]
        required = rule.get("required", True)

        found, value = _get_nested(output, path)

        if not found:
            if required:
                errors.append(f"Missing required field: '{path}'")
            continue

        if not isinstance(value, expected_type):
            errors.append(
                f"Field '{path}' expected {expected_type.__name__}, "
                f"got {type(value).__name__}"
            )

    is_valid = len(errors) == 0
    if not is_valid:
        logger.warning(
            "Agent '%s' output validation failed: %s",
            agent_type,
            "; ".join(errors),
        )
    return is_valid, errors


def validate_or_warn(agent_type: str, output: dict[str, Any]) -> dict[str, Any]:
    """
    Validate and inject a '_validation' key into the output.
    Does NOT raise — callers get the output either way, with warnings attached.
    """
    is_valid, errors = validate_agent_output(agent_type, output)
    if not is_valid:
        output["_validation"] = {
            "valid": False,
            "errors": errors,
        }
        logger.warning(
            "Agent '%s' produced output with schema violations. "
            "Results may be incomplete. Errors: %s",
            agent_type,
            errors,
        )
    return output
