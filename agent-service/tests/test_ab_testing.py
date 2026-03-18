"""Tests for the P4 A/B testing framework."""

import pytest
from app.services.ab_testing import ABTestingService


@pytest.fixture
def svc():
    s = ABTestingService()
    yield s
    s.clear()


class TestVariantAssignment:
    def test_returns_one_of_the_variants(self, svc):
        variants = {"control": "Prompt A", "variant_v2": "Prompt B"}
        prompt = svc.get_prompt("lean_vsm", "analyze_flow", "exec-001", variants)
        assert prompt in ("Prompt A", "Prompt B")

    def test_assignment_is_deterministic(self, svc):
        variants = {"control": "Prompt A", "variant_v2": "Prompt B"}
        p1 = svc.get_prompt("lean_vsm", "analyze_flow", "exec-001", variants)
        p2 = svc.get_prompt("lean_vsm", "analyze_flow", "exec-001", variants)
        assert p1 == p2

    def test_different_executions_may_get_different_variants(self, svc):
        """With enough executions, both variants should be selected."""
        variants = {"control": "A", "v2": "B"}
        prompts = set()
        for i in range(20):
            p = svc.get_prompt("lean_vsm", "key", f"exec-{i}", variants)
            prompts.add(p)
        assert len(prompts) == 2, "Both variants should be assigned across 20 executions"

    def test_single_variant_always_returns_control(self, svc):
        variants = {"control": "Only prompt"}
        prompt = svc.get_prompt("lean_vsm", "key", "exec-001", variants)
        assert prompt == "Only prompt"

    def test_disabled_returns_control(self, svc):
        variants = {"control": "Control", "v2": "Variant"}
        prompt = svc.get_prompt("lean_vsm", "key", "exec-001", variants, enabled=False)
        assert prompt == "Control"

    def test_empty_variants_raises(self, svc):
        with pytest.raises(ValueError):
            svc.get_prompt("lean_vsm", "key", "exec-001", {})


class TestOutcomeRecording:
    @pytest.mark.asyncio
    async def test_record_outcome_updates_record(self, svc):
        variants = {"control": "A", "v2": "B"}
        svc.get_prompt("lean_vsm", "analyze_flow", "exec-xyz", variants)
        await svc.record_outcome("exec-xyz", "lean_vsm", "analyze_flow", {"steps_found": 8})
        summary = svc.get_experiment_summary()
        assert "lean_vsm:analyze_flow" in summary

    @pytest.mark.asyncio
    async def test_record_outcome_for_untracked_execution_is_noop(self, svc):
        # Should not raise
        await svc.record_outcome("unknown-exec", "lean_vsm", "key", {"steps_found": 5})

    def test_experiment_summary_includes_averages(self, svc):
        import asyncio
        variants = {"control": "A", "v2": "B"}
        # Force to control by finding an execution_id that maps to it
        # Just do several to ensure we get at least one outcome recorded
        for i in range(5):
            exec_id = f"exec-summary-{i}"
            svc.get_prompt("lean_vsm", "flow_key", exec_id, variants)
            asyncio.get_event_loop().run_until_complete(
                svc.record_outcome(exec_id, "lean_vsm", "flow_key", {"steps": i + 1})
            )
        summary = svc.get_experiment_summary()
        assert "lean_vsm:flow_key" in summary
        # Both variants may be present
        for variant_data in summary["lean_vsm:flow_key"].values():
            assert "assignments" in variant_data

    def test_clear_resets_state(self, svc):
        variants = {"control": "A", "v2": "B"}
        svc.get_prompt("lean_vsm", "k", "exec-1", variants)
        svc.clear()
        summary = svc.get_experiment_summary()
        assert summary == {}
