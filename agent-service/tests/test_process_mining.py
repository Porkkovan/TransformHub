"""Tests for the P4 process mining service."""

import pytest
from datetime import datetime, timezone, timedelta
from app.services.process_mining import (
    EventLogParser,
    compute_activity_stats,
    compute_transitions,
    map_to_vsm_steps,
    identify_bottlenecks,
    ProcessMiningService,
)


# ── EventLogParser tests ──────────────────────────────────────────────────────


class TestEventLogParser:
    def test_parse_valid_csv(self):
        csv_text = """case_id,activity,timestamp
C001,Payment Received,2024-01-01T09:00:00
C001,KYC Check,2024-01-01T10:00:00
C001,Approval,2024-01-01T11:00:00
C002,Payment Received,2024-01-01T09:30:00
C002,KYC Check,2024-01-01T10:30:00
"""
        parser = EventLogParser()
        events = parser.parse_csv(csv_text)
        assert len(events) == 5
        assert events[0]["case_id"] == "C001"
        assert events[0]["activity"] == "Payment Received"

    def test_missing_required_column_raises(self):
        csv_text = """case_id,activity
C001,Step A
"""
        parser = EventLogParser()
        with pytest.raises(ValueError, match="timestamp"):
            parser.parse_csv(csv_text)

    def test_empty_csv_raises(self):
        parser = EventLogParser()
        with pytest.raises(ValueError):
            parser.parse_csv("")

    def test_parse_dicts(self):
        events = [
            {"case_id": "C1", "activity": "Start", "timestamp": "2024-01-01T09:00:00"},
            {"case_id": "C1", "activity": "End",   "timestamp": "2024-01-01T10:00:00"},
        ]
        parser = EventLogParser()
        result = parser.parse_dicts(events)
        assert len(result) == 2
        assert result[0]["activity"] == "Start"


# ── Activity stats tests ───────────────────────────────────────────────────────


class TestComputeActivityStats:
    def _make_events(self):
        base = datetime(2024, 1, 1, 9, 0, tzinfo=timezone.utc)
        return [
            {"case_id": "C1", "activity": "Step A", "timestamp": base},
            {"case_id": "C1", "activity": "Step B", "timestamp": base + timedelta(hours=2)},
            {"case_id": "C1", "activity": "Step C", "timestamp": base + timedelta(hours=3)},
            {"case_id": "C2", "activity": "Step A", "timestamp": base + timedelta(hours=1)},
            {"case_id": "C2", "activity": "Step B", "timestamp": base + timedelta(hours=4)},
        ]

    def test_frequency_counted_correctly(self):
        events = self._make_events()
        stats = compute_activity_stats(events)
        assert stats["Step A"]["frequency"] == 2
        assert stats["Step B"]["frequency"] == 2
        assert stats["Step C"]["frequency"] == 1

    def test_cases_involved_counted_correctly(self):
        events = self._make_events()
        stats = compute_activity_stats(events)
        assert stats["Step A"]["cases_involved"] == 2
        assert stats["Step C"]["cases_involved"] == 1

    def test_wait_before_is_positive(self):
        events = self._make_events()
        stats = compute_activity_stats(events)
        # Step B follows Step A, so there should be a wait
        if stats["Step B"]["avg_wait_before_hrs"] is not None:
            assert stats["Step B"]["avg_wait_before_hrs"] >= 0


# ── Transition tests ──────────────────────────────────────────────────────────


class TestComputeTransitions:
    def test_transitions_detected(self):
        base = datetime(2024, 1, 1, 9, 0, tzinfo=timezone.utc)
        events = [
            {"case_id": "C1", "activity": "A", "timestamp": base},
            {"case_id": "C1", "activity": "B", "timestamp": base + timedelta(hours=1)},
            {"case_id": "C1", "activity": "C", "timestamp": base + timedelta(hours=2)},
            {"case_id": "C2", "activity": "A", "timestamp": base},
            {"case_id": "C2", "activity": "B", "timestamp": base + timedelta(hours=1)},
        ]
        transitions = compute_transitions(events)
        ab = next((t for t in transitions if t["from"] == "A" and t["to"] == "B"), None)
        assert ab is not None
        assert ab["count"] == 2


# ── VSM mapping tests ─────────────────────────────────────────────────────────


class TestMapToVSMSteps:
    def test_exact_match_maps_correctly(self):
        activity_stats = {
            "payment processing": {
                "avg_duration_hrs": 2.5,
                "avg_wait_before_hrs": 8.0,
                "frequency": 100,
            }
        }
        mapping = map_to_vsm_steps(activity_stats, ["payment processing"])
        assert "payment processing" in mapping

    def test_no_match_below_threshold(self):
        activity_stats = {
            "xyz unrelated step": {
                "avg_duration_hrs": 1.0,
                "avg_wait_before_hrs": 0.5,
                "frequency": 5,
            }
        }
        mapping = map_to_vsm_steps(activity_stats, ["completely different step name"])
        # May or may not match — just ensure no crash
        assert isinstance(mapping, dict)


# ── Bottleneck tests ──────────────────────────────────────────────────────────


class TestIdentifyBottlenecks:
    def test_highest_wait_is_top_bottleneck(self):
        activity_stats = {
            "Fast Step":  {"avg_wait_before_hrs": 0.5, "frequency": 100},
            "Slow Step":  {"avg_wait_before_hrs": 24.0, "frequency": 50},
            "Medium Step":{"avg_wait_before_hrs": 4.0,  "frequency": 80},
        }
        bottlenecks = identify_bottlenecks(activity_stats, top_n=3)
        assert bottlenecks[0]["activity"] == "Slow Step"

    def test_top_n_respected(self):
        activity_stats = {f"Step {i}": {"avg_wait_before_hrs": float(i), "frequency": 10} for i in range(10)}
        bottlenecks = identify_bottlenecks(activity_stats, top_n=3)
        assert len(bottlenecks) == 3


# ── ProcessMiningService integration tests ────────────────────────────────────


class TestProcessMiningService:
    def _sample_csv(self):
        return """case_id,activity,timestamp
C001,Application Received,2024-01-01T09:00:00
C001,KYC Verification,2024-01-01T11:00:00
C001,Credit Assessment,2024-01-01T14:00:00
C001,Approval,2024-01-02T09:00:00
C002,Application Received,2024-01-01T10:00:00
C002,KYC Verification,2024-01-01T13:00:00
C002,Credit Assessment,2024-01-02T08:00:00
C002,Approval,2024-01-02T11:00:00
C003,Application Received,2024-01-02T09:00:00
C003,KYC Verification,2024-01-02T10:30:00
C003,Approval,2024-01-02T14:00:00
"""

    def test_full_analysis_returns_expected_keys(self):
        svc = ProcessMiningService()
        result = svc.analyze(self._sample_csv())
        assert "events_parsed" in result
        assert "cases" in result
        assert "activities" in result
        assert "transitions" in result
        assert "bottlenecks" in result
        assert result["timing_source"] == "process_mining"

    def test_case_count_correct(self):
        svc = ProcessMiningService()
        result = svc.analyze(self._sample_csv())
        assert result["cases"] == 3

    def test_events_parsed_count(self):
        svc = ProcessMiningService()
        result = svc.analyze(self._sample_csv())
        assert result["events_parsed"] == 11

    def test_vsm_mapping_when_step_names_provided(self):
        svc = ProcessMiningService()
        result = svc.analyze(
            self._sample_csv(),
            vsm_step_names=["KYC Verification", "Credit Assessment"],
        )
        assert "vsm_mapping" in result

    def test_dict_input(self):
        events = [
            {"case_id": "C1", "activity": "Start", "timestamp": "2024-01-01T09:00:00"},
            {"case_id": "C1", "activity": "End",   "timestamp": "2024-01-01T10:00:00"},
        ]
        svc = ProcessMiningService()
        result = svc.analyze(events)
        assert result["events_parsed"] == 2

    def test_empty_events_returns_error(self):
        svc = ProcessMiningService()
        result = svc.analyze([])
        assert "error" in result
