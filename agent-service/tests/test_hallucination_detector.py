"""Tests for the P4 hallucination detection layer."""

import pytest
from app.services.hallucination_detector import (
    detect_hallucinations,
    detect_vsm_hallucinations,
    detect_discovery_hallucinations,
    detect_risk_hallucinations,
)


# ── VSM hallucination tests ────────────────────────────────────────────────────


class TestVSMHallucinations:
    def _vsm_output(self, steps):
        return {"capabilities": [{"capability_name": "Payments", "steps": steps}]}

    def test_clean_output_no_flags(self):
        output = self._vsm_output([{
            "step_name": "Payment Processing",
            "process_time_hrs": 2.5,
            "wait_time_hrs": 8.0,
            "lead_time_hrs": 10.5,
            "flow_efficiency": 0.24,
        }])
        flags = detect_vsm_hallucinations(output)
        assert flags == []

    def test_negative_process_time_is_critical(self):
        output = self._vsm_output([{
            "step_name": "Step A",
            "process_time_hrs": -1.0,
            "wait_time_hrs": 8.0,
            "lead_time_hrs": 7.0,
            "flow_efficiency": 0.5,
        }])
        flags = detect_vsm_hallucinations(output)
        critical = [f for f in flags if f["severity"] == "critical"]
        assert any("process_time_hrs" in f["field"] for f in critical)

    def test_flow_efficiency_over_100_percent_is_critical(self):
        output = self._vsm_output([{
            "step_name": "Step A",
            "process_time_hrs": 2.0,
            "wait_time_hrs": 0.0,
            "lead_time_hrs": 2.0,
            "flow_efficiency": 1.5,
        }])
        flags = detect_vsm_hallucinations(output)
        assert any(f["severity"] == "critical" and "flow_efficiency" in f["field"] for f in flags)

    def test_flow_efficiency_exactly_100_is_warning(self):
        output = self._vsm_output([{
            "step_name": "Step A",
            "process_time_hrs": 2.0,
            "wait_time_hrs": 0.0,
            "lead_time_hrs": 2.0,
            "flow_efficiency": 1.0,
        }])
        flags = detect_vsm_hallucinations(output)
        assert any(f["severity"] == "warning" and "flow_efficiency" in f["field"] for f in flags)

    def test_lead_time_less_than_sum_is_critical(self):
        output = self._vsm_output([{
            "step_name": "Step A",
            "process_time_hrs": 4.0,
            "wait_time_hrs": 8.0,
            "lead_time_hrs": 5.0,  # Should be >= 12.0
        }])
        flags = detect_vsm_hallucinations(output)
        assert any(f["severity"] == "critical" and "lead_time_hrs" in f["field"] for f in flags)

    def test_round_number_generates_info_flag(self):
        output = self._vsm_output([{
            "step_name": "Step A",
            "process_time_hrs": 80.0,  # Suspiciously round
            "wait_time_hrs": 20.0,     # Suspiciously round
            "lead_time_hrs": 100.0,
            "flow_efficiency": 0.80,
        }])
        flags = detect_vsm_hallucinations(output)
        info_flags = [f for f in flags if f["severity"] == "info"]
        assert len(info_flags) >= 1

    def test_placeholder_capability_name_is_warning(self):
        output = {"capabilities": [{"capability_name": "Capability 1", "steps": []}]}
        flags = detect_vsm_hallucinations(output)
        assert any(f["severity"] == "warning" and "capability_name" in f["field"] for f in flags)

    def test_excessive_process_time_is_warning(self):
        output = self._vsm_output([{
            "step_name": "Step A",
            "process_time_hrs": 5000.0,  # Exceeds max
            "wait_time_hrs": 0.0,
            "lead_time_hrs": 5000.0,
        }])
        flags = detect_vsm_hallucinations(output)
        assert any(f["severity"] == "warning" and "process_time_hrs" in f["field"] for f in flags)


# ── Discovery hallucination tests ─────────────────────────────────────────────


class TestDiscoveryHallucinations:
    def test_clean_output_no_flags(self):
        output = {
            "functionalities": [{"name": "User Authentication"}, {"name": "Payment Processing"}],
            "capabilities": [{"name": "Digital Banking"}],
        }
        flags = detect_discovery_hallucinations(output)
        assert flags == []

    def test_placeholder_functionality_name(self):
        output = {
            "functionalities": [{"name": "Functionality 1"}],
            "capabilities": [],
        }
        flags = detect_discovery_hallucinations(output)
        assert any("functionalities" in f["field"] for f in flags)

    def test_inflated_functionality_count_is_warning(self):
        output = {
            "functionalities": [{"name": f"Real Feature {i}"} for i in range(201)],
            "capabilities": [],
        }
        flags = detect_discovery_hallucinations(output)
        assert any("functionalities" in f["field"] and f["severity"] == "warning" for f in flags)


# ── Risk hallucination tests ───────────────────────────────────────────────────


class TestRiskHallucinations:
    def test_valid_scores_no_flags(self):
        output = {
            "risk_scores": [
                {"name": "Data Privacy", "score": 7.5},
                {"name": "Operational Risk", "score": 4.0},
            ]
        }
        flags = detect_risk_hallucinations(output)
        assert flags == []

    def test_score_out_of_range_is_critical(self):
        output = {
            "risk_scores": [{"name": "Test", "score": 15}]
        }
        flags = detect_risk_hallucinations(output)
        assert any(f["severity"] == "critical" for f in flags)

    def test_all_identical_scores_is_warning(self):
        output = {
            "risk_scores": [
                {"name": "Risk A", "score": 5.0},
                {"name": "Risk B", "score": 5.0},
                {"name": "Risk C", "score": 5.0},
            ]
        }
        flags = detect_risk_hallucinations(output)
        assert any(f["severity"] == "warning" for f in flags)


# ── detect_hallucinations dispatcher ─────────────────────────────────────────


class TestDetectHallucinationsDispatcher:
    def test_injects_hallucination_flags_key(self):
        output = {"capabilities": [{"capability_name": "Payments", "steps": []}]}
        result = detect_hallucinations("lean_vsm", output)
        assert "_hallucination_flags" in result

    def test_unknown_agent_type_returns_output_unchanged(self):
        output = {"some": "data"}
        result = detect_hallucinations("unknown_agent", output)
        assert "_hallucination_flags" not in result
        assert result == {"some": "data"}

    def test_critical_count_is_correct(self):
        output = {"capabilities": [{"capability_name": "Cap1", "steps": [{
            "step_name": "Step",
            "process_time_hrs": -5.0,  # critical
            "wait_time_hrs": 0.0,
            "lead_time_hrs": 0.0,
            "flow_efficiency": 1.5,    # critical
        }]}]}
        result = detect_hallucinations("lean_vsm", output)
        assert result["_hallucination_flags"]["critical"] >= 2

    def test_detector_never_raises(self):
        # Even with malformed input, should not raise
        result = detect_hallucinations("lean_vsm", {"capabilities": "not_a_list"})
        assert "_hallucination_flags" in result
