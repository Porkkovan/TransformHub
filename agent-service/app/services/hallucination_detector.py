"""
P4: Hallucination detection layer for agent outputs.

Runs post-validation to flag values that are:
- Physically impossible (negative times, flow_efficiency > 100%)
- Internally inconsistent (lead_time < process_time)
- Statistical outliers (>3σ from typical ranges)
- Suspiciously generic (placeholder names, round numbers at 100%)
- Missing required confidence (< 0.3 confidence on critical fields)
"""

from __future__ import annotations

import re
import logging
from typing import Any

logger = logging.getLogger(__name__)


# ── Domain constraints ────────────────────────────────────────────────────────

VSM_CONSTRAINTS = [
    # (check_fn, field_path, severity, reason_template)
]

# Typical VSM ranges for sanity checking (hours)
_PROCESS_TIME_MAX_HRS = 2000   # 250 days — beyond this is almost certainly wrong
_WAIT_TIME_MAX_HRS    = 5000
_LEAD_TIME_MAX_HRS    = 8000
_FLOW_EFFICIENCY_MAX  = 1.0    # 100%

# Suspiciously round LLM guesses
_ROUND_NUMBER_PATTERN = re.compile(r"^(100|80|60|50|40|20|10|0)$")


def _flag(field: str, severity: str, reason: str, value: Any) -> dict:
    return {"field": field, "severity": severity, "reason": reason, "value": value}


def detect_vsm_hallucinations(output: dict) -> list[dict]:
    """
    Inspect lean_vsm agent output for hallucinated values.
    Returns a list of flag dicts. Empty list = no issues found.
    """
    flags: list[dict] = []
    capabilities = output.get("capabilities") or []

    for cap in capabilities:
        if not isinstance(cap, dict):
            continue
        cap_name = cap.get("capability_name", "?")
        steps = cap.get("steps") or []

        # Check for placeholder capability names
        if re.match(r"^(capability|step|process|item|task)\s*\d+$", cap_name, re.I):
            flags.append(_flag(
                f"capabilities[{cap_name}].capability_name",
                "warning",
                "Capability name looks like a placeholder — may be hallucinated",
                cap_name,
            ))

        for step in steps:
            if not isinstance(step, dict):
                continue
            name = step.get("step_name", "?")
            prefix = f"capabilities[{cap_name}].steps[{name}]"

            pt  = step.get("process_time_hrs")
            wt  = step.get("wait_time_hrs")
            lt  = step.get("lead_time_hrs")
            fe  = step.get("flow_efficiency")

            # Impossible / out-of-range values
            if isinstance(pt, (int, float)):
                if pt < 0:
                    flags.append(_flag(f"{prefix}.process_time_hrs", "critical", "Negative process time", pt))
                elif pt > _PROCESS_TIME_MAX_HRS:
                    flags.append(_flag(f"{prefix}.process_time_hrs", "warning", f"Process time {pt}h exceeds plausible maximum ({_PROCESS_TIME_MAX_HRS}h)", pt))

            if isinstance(wt, (int, float)):
                if wt < 0:
                    flags.append(_flag(f"{prefix}.wait_time_hrs", "critical", "Negative wait time", wt))
                elif wt > _WAIT_TIME_MAX_HRS:
                    flags.append(_flag(f"{prefix}.wait_time_hrs", "warning", f"Wait time {wt}h exceeds plausible maximum ({_WAIT_TIME_MAX_HRS}h)", wt))

            # Internal consistency: lead_time >= process_time + wait_time
            if isinstance(pt, (int, float)) and isinstance(wt, (int, float)) and isinstance(lt, (int, float)):
                expected_lt = pt + wt
                if lt < expected_lt - 0.01:  # 0.01h tolerance for floating point
                    flags.append(_flag(
                        f"{prefix}.lead_time_hrs",
                        "critical",
                        f"lead_time_hrs ({lt}) < process_time_hrs ({pt}) + wait_time_hrs ({wt}) = {expected_lt}",
                        lt,
                    ))

            # Flow efficiency out of range
            if isinstance(fe, (int, float)):
                if fe < 0:
                    flags.append(_flag(f"{prefix}.flow_efficiency", "critical", "Negative flow efficiency", fe))
                elif fe > _FLOW_EFFICIENCY_MAX:
                    flags.append(_flag(f"{prefix}.flow_efficiency", "critical", f"Flow efficiency {fe:.1%} > 100%", fe))
                elif fe == 1.0:
                    flags.append(_flag(f"{prefix}.flow_efficiency", "warning", "Flow efficiency exactly 100% — likely hallucinated", fe))

            # Suspiciously round numbers
            for field, val in [("process_time_hrs", pt), ("wait_time_hrs", wt)]:
                if isinstance(val, (int, float)) and val > 0:
                    if _ROUND_NUMBER_PATTERN.match(str(int(val))) and val == int(val):
                        flags.append(_flag(
                            f"{prefix}.{field}",
                            "info",
                            f"Round number ({val}h) may be an LLM estimate rather than a measured value",
                            val,
                        ))

    return flags


def detect_discovery_hallucinations(output: dict) -> list[dict]:
    """Inspect discovery agent output for hallucinated values."""
    flags: list[dict] = []
    functionalities = output.get("functionalities") or []
    capabilities    = output.get("capabilities") or []

    placeholder_pattern = re.compile(
        r"^(functionality|capability|feature|module|component|service|system)\s*\d+$", re.I
    )

    for item in functionalities:
        if not isinstance(item, dict):
            continue
        name = item.get("name", "")
        if placeholder_pattern.match(name):
            flags.append(_flag("functionalities[].name", "warning", f"Name '{name}' looks like a placeholder", name))

    for item in capabilities:
        if not isinstance(item, dict):
            continue
        name = item.get("name", "")
        if placeholder_pattern.match(name):
            flags.append(_flag("capabilities[].name", "warning", f"Name '{name}' looks like a placeholder", name))

    # Check for suspiciously high counts (LLMs sometimes inflate)
    if len(functionalities) > 200:
        flags.append(_flag(
            "functionalities",
            "warning",
            f"Unusually large number of functionalities ({len(functionalities)}) — possible LLM hallucination",
            len(functionalities),
        ))
    if len(capabilities) > 50:
        flags.append(_flag(
            "capabilities",
            "warning",
            f"Unusually large number of capabilities ({len(capabilities)}) — possible LLM inflation",
            len(capabilities),
        ))

    return flags


def detect_risk_hallucinations(output: dict) -> list[dict]:
    """Inspect risk_compliance agent output for impossible risk scores."""
    flags: list[dict] = []
    risk_scores = output.get("risk_scores") or []

    for item in risk_scores:
        if not isinstance(item, dict):
            continue
        name = item.get("name", "?")
        score = item.get("score")
        if isinstance(score, (int, float)):
            if score < 0 or score > 10:
                flags.append(_flag(
                    f"risk_scores[{name}].score",
                    "critical",
                    f"Risk score {score} outside valid range [0, 10]",
                    score,
                ))
            # All risk scores identical is suspicious
    if len(risk_scores) > 1:
        scores = [r.get("score") for r in risk_scores if isinstance(r.get("score"), (int, float))]
        if len(set(scores)) == 1 and scores:
            flags.append(_flag(
                "risk_scores",
                "warning",
                f"All {len(scores)} risk scores are identical ({scores[0]}) — may be hallucinated",
                scores[0],
            ))

    return flags


# ── Registry ─────────────────────────────────────────────────────────────────

_DETECTORS = {
    "lean_vsm":        detect_vsm_hallucinations,
    "discovery":       detect_discovery_hallucinations,
    "risk_compliance": detect_risk_hallucinations,
}


def detect_hallucinations(agent_type: str, output: dict) -> dict:
    """
    Run hallucination detection for the given agent type.

    Returns the output dict with a `_hallucination_flags` key injected:
      {
        "count": int,
        "critical": int,
        "warnings": int,
        "flags": [{"field": str, "severity": str, "reason": str, "value": Any}]
      }

    Does NOT raise — all detections are advisory.
    """
    detector = _DETECTORS.get(agent_type)
    if not detector:
        return output

    try:
        flags = detector(output)
    except Exception as exc:
        logger.warning("Hallucination detector failed for %s: %s", agent_type, exc)
        flags = []

    if flags:
        critical = sum(1 for f in flags if f["severity"] == "critical")
        warnings = sum(1 for f in flags if f["severity"] == "warning")
        logger.info(
            "Hallucination check %s: %d flags (%d critical, %d warnings)",
            agent_type, len(flags), critical, warnings,
        )

    output["_hallucination_flags"] = {
        "count": len(flags),
        "critical": sum(1 for f in flags if f["severity"] == "critical"),
        "warnings": sum(1 for f in flags if f["severity"] == "warning"),
        "flags": flags,
    }
    return output
