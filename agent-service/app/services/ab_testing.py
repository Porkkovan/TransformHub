"""
P4: A/B testing framework for prompt variants.

Allows registering multiple prompt variants per (agent_type, prompt_key),
assigning variants deterministically by execution_id hash, and recording
outcome quality for offline analysis.

Usage::

    from app.services.ab_testing import ab_test

    prompt = ab_test.get_prompt(
        agent_type="lean_vsm",
        prompt_key="analyze_flow",
        execution_id=execution_id,
        variants={
            "control": ORIGINAL_ANALYZE_PROMPT,
            "v2_concise": CONCISE_ANALYZE_PROMPT,
        },
    )
    # Use prompt in LLM call ...
    await ab_test.record_outcome(execution_id, "lean_vsm", "analyze_flow", {"steps_found": n})
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class ExperimentRecord:
    execution_id: str
    agent_type: str
    prompt_key: str
    variant: str
    assigned_at: float = field(default_factory=time.time)
    outcome: Optional[dict] = None
    outcome_at: Optional[float] = None


class ABTestingService:
    """
    In-process A/B testing service.

    Variant assignment is deterministic: hash(execution_id + prompt_key) mod len(variants).
    This ensures the same execution always gets the same variant (reproducible).

    Outcomes are stored in-memory and exposed via /metrics for offline analysis.
    For production scale, wire record_outcome to write to the DB or an analytics sink.
    """

    def __init__(self) -> None:
        self._records: dict[str, ExperimentRecord] = {}   # keyed by execution_id+prompt_key
        self._active_experiments: set[str] = set()        # "agent_type:prompt_key" pairs

    def get_prompt(
        self,
        agent_type: str,
        prompt_key: str,
        execution_id: str,
        variants: dict[str, str],
        *,
        enabled: bool = True,
    ) -> str:
        """
        Return a prompt string for the given execution, assigned to a variant.

        If ``enabled`` is False or only one variant is registered, returns the
        first variant (control) without recording an experiment.

        ``variants`` is an ordered dict: first key is always the "control".
        """
        if not variants:
            raise ValueError("At least one prompt variant must be provided")

        variant_names = list(variants.keys())

        if not enabled or len(variant_names) == 1:
            return variants[variant_names[0]]

        # Deterministic assignment: hash(execution_id + prompt_key)
        seed = f"{execution_id}:{prompt_key}".encode()
        idx  = int(hashlib.sha256(seed).hexdigest(), 16) % len(variant_names)
        chosen = variant_names[idx]

        record_key = f"{execution_id}:{prompt_key}"
        self._records[record_key] = ExperimentRecord(
            execution_id=execution_id,
            agent_type=agent_type,
            prompt_key=prompt_key,
            variant=chosen,
        )
        self._active_experiments.add(f"{agent_type}:{prompt_key}")

        logger.debug(
            "A/B assignment execution=%s prompt=%s:%s variant=%s",
            execution_id, agent_type, prompt_key, chosen,
        )
        return variants[chosen]

    async def record_outcome(
        self,
        execution_id: str,
        agent_type: str,
        prompt_key: str,
        outcome: dict,
    ) -> None:
        """
        Record the quality outcome for a prior variant assignment.

        ``outcome`` is agent-specific quality metrics, e.g.:
          - lean_vsm: {"steps_found": 12, "avg_confidence": 0.72, "hallucination_flags": 0}
          - discovery: {"capabilities_found": 8, "functionalities_found": 47}
        """
        record_key = f"{execution_id}:{prompt_key}"
        rec = self._records.get(record_key)
        if rec is None:
            # Execution didn't go through get_prompt (single-variant or disabled) — no-op
            return
        rec.outcome = outcome
        rec.outcome_at = time.time()

    def get_experiment_summary(self) -> dict[str, Any]:
        """Return per-variant outcome statistics for all active experiments."""
        summary: dict[str, dict[str, Any]] = {}

        for rec in self._records.values():
            exp_key = f"{rec.agent_type}:{rec.prompt_key}"
            if exp_key not in summary:
                summary[exp_key] = {}
            variant_data = summary[exp_key].setdefault(
                rec.variant,
                {"assignments": 0, "outcomes": 0, "outcome_samples": []},
            )
            variant_data["assignments"] += 1
            if rec.outcome is not None:
                variant_data["outcomes"] += 1
                variant_data["outcome_samples"].append(rec.outcome)

        # Compute per-metric averages
        for exp_key, variants in summary.items():
            for variant, data in variants.items():
                samples = data.pop("outcome_samples", [])
                if samples:
                    # Average all numeric fields across samples
                    all_keys = set(k for s in samples for k in s)
                    averages = {}
                    for k in all_keys:
                        vals = [s[k] for s in samples if isinstance(s.get(k), (int, float))]
                        if vals:
                            averages[k] = round(sum(vals) / len(vals), 4)
                    data["avg_outcomes"] = averages

        return summary

    def clear(self) -> None:
        """Clear all in-memory experiment records (e.g. for testing)."""
        self._records.clear()
        self._active_experiments.clear()


# Module-level singleton
ab_test = ABTestingService()
