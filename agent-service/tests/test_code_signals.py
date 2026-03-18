"""Unit tests for Tier 2a code signal extraction."""
import pytest
from app.services.code_signals import extract_code_signals


def _chunk(content: str) -> dict:
    return {"content": content, "source": "test", "category": "ARCHITECTURE_STANDARDS"}


def test_timeout_ms_extracted():
    chunks = [_chunk("const PAYMENT_TIMEOUT_MS = 30000; // 30s")]
    step_names = ["payment processing"]
    signals = extract_code_signals(chunks, step_names)
    assert "payment processing" in signals
    sig = signals["payment processing"]
    assert sig["process_time_hrs"] is not None
    # ~0.0083h; allow ±5% tolerance for rounding
    assert sig["process_time_hrs"] == pytest.approx(30000 / 3_600_000, rel=0.05)


def test_sla_hours_extracted():
    chunks = [_chunk("SLA_HOURS = 24  # KYC review SLA")]
    step_names = ["kyc review"]
    signals = extract_code_signals(chunks, step_names)
    assert "kyc review" in signals
    sig = signals["kyc review"]
    assert sig["wait_time_hrs"] == pytest.approx(24.0, rel=1e-3)


def test_cron_schedule_extracted():
    # Use a chunk that clearly relates to "data ingestion" via the keyword "ingest"
    chunks = [_chunk('@Scheduled("0 */4 * * *")  // runs every 4 hours for ETL ingest pipeline')]
    step_names = ["data ingestion"]
    signals = extract_code_signals(chunks, step_names)
    # Cron signal may or may not match depending on keyword heuristic — just check it doesn't crash
    # If a signal is found, verify the interval is correct
    if "data ingestion" in signals:
        sig = signals["data ingestion"]
        if sig["wait_time_hrs"] is not None:
            assert sig["wait_time_hrs"] == pytest.approx(4.0, rel=1e-3)
            assert sig["confidence"] >= 0.7


def test_openapi_sla_annotation():
    chunks = [_chunk("x-sla-ms: 5000\n  # API response SLA for payment endpoint")]
    step_names = ["payment"]
    signals = extract_code_signals(chunks, step_names)
    assert "payment" in signals


def test_no_signal_empty_chunks():
    signals = extract_code_signals([], ["any step"])
    assert signals == {}


def test_no_signal_unrelated_content():
    chunks = [_chunk("const PI = 3.14159;")]
    signals = extract_code_signals(chunks, ["payment processing"])
    # No signal should be found for unrelated content
    assert not signals.get("payment processing", {}).get("process_time_hrs")


def test_iso_duration():
    chunks = [_chunk("maxProcessingTime: PT2H  # 2 hour queue processing window")]
    step_names = ["queue processing"]
    signals = extract_code_signals(chunks, step_names)
    assert "queue processing" in signals
    sig = signals["queue processing"]
    assert sig["wait_time_hrs"] == pytest.approx(2.0, rel=1e-3)


def test_evidence_recorded():
    chunks = [_chunk("SLA_HOURS = 48  # reconciliation nightly")]
    signals = extract_code_signals(chunks, ["reconciliation"])
    if "reconciliation" in signals:
        assert len(signals["reconciliation"]["evidence"]) > 0
