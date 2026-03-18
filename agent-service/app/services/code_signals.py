"""
Tier 2a: Code signal extraction for VSM timing enrichment.

Scans context documents and code embeddings for hard signals that indicate
process or wait times without requiring LLM estimation:

- Timeout values (e.g. TIMEOUT_MS = 30000 → 0.008h)
- Cron/schedule intervals (e.g. @Scheduled("0 */4 * * *") → every 4h)
- SLA constants (e.g. SLA_HOURS = 24 → 24h wait)
- Retry delays (e.g. RETRY_DELAY_SECONDS = 300 → 5 min wait per retry)
- Queue configs (e.g. maxProcessingTime = "PT2H" → 2h)
- OpenAPI x-sla-ms / x-timeout annotations

Returns a dict keyed by lowercase step name prefix → timing hints.
"""

from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# ─── Patterns ────────────────────────────────────────────────────────────────

_TIMEOUT_PATTERNS = [
    # TIMEOUT_MS = 30000  or  timeout: 30000  or  timeoutMs: 30000
    re.compile(r'(?i)timeout[_\s]*(?:ms|millis|milliseconds)?\s*[=:]\s*(\d+)', re.IGNORECASE),
    # TIMEOUT_SECONDS = 60  or  timeout_sec: 60
    re.compile(r'(?i)timeout[_\s]*(?:sec(?:onds?)?)?\s*[=:]\s*(\d+)\s*(?:#.*)?$', re.MULTILINE),
]

_SLA_PATTERNS = [
    # SLA_HOURS = 24  or  SLA_HOURS: 24  or  slaHours = 24
    re.compile(r'(?i)sla[_\s]*hours?\s*[=:]\s*(\d+\.?\d*)', re.IGNORECASE),
    re.compile(r'(?i)sla[_\s]*(?:minutes?|mins?)\s*[=:]\s*(\d+\.?\d*)', re.IGNORECASE),
    # x-sla-ms: 5000  (OpenAPI extension)
    re.compile(r'(?i)x-sla-ms\s*:\s*(\d+)', re.IGNORECASE),
    re.compile(r'(?i)x-timeout\s*:\s*(\d+)', re.IGNORECASE),
    re.compile(r'(?i)x-p99-latency-ms\s*:\s*(\d+)', re.IGNORECASE),
]

_CRON_PATTERNS = [
    # @Scheduled("0 */4 * * *") or cron: "0 */4 * * *"
    re.compile(r'(?:cron|@[Ss]cheduled)\s*[=("]([0-9*,/\- ]+)[")]', re.IGNORECASE),
]

_ISO_DURATION_PATTERNS = [
    # PT2H, P1D, PT30M, etc.
    re.compile(r'PT?(\d+)([HDMS])', re.IGNORECASE),
]

_RETRY_PATTERNS = [
    re.compile(r'(?i)retry[_\s]*delay[_\s]*(?:seconds?|ms|millis)?\s*[=:]\s*(\d+)', re.IGNORECASE),
    re.compile(r'(?i)back[_\s]*off[_\s]*(?:seconds?|ms|millis)?\s*[=:]\s*(\d+)', re.IGNORECASE),
]

# Keywords that hint which step a code chunk relates to
_STEP_KEYWORDS: list[tuple[str, list[str]]] = [
    ("authentication",    ["auth", "login", "token", "jwt", "oauth", "saml"]),
    ("authorization",     ["authz", "permission", "role", "access control"]),
    ("data ingestion",    ["ingest", "import", "fetch", "extract", "etl"]),
    ("data processing",   ["process", "transform", "parse", "compute", "calculate"]),
    ("data validation",   ["validat", "schema", "constraint", "checksum"]),
    ("api integration",   ["api", "http", "rest", "grpc", "webhook", "endpoint"]),
    ("notification",      ["notify", "alert", "email", "sms", "push", "event"]),
    ("reporting",         ["report", "dashboard", "export", "generate"]),
    ("review",            ["review", "approval", "audit", "manual check"]),
    ("deployment",        ["deploy", "release", "ci/cd", "pipeline", "build"]),
    ("queue processing",  ["queue", "topic", "consumer", "broker", "kafka", "rabbitmq"]),
    ("payment",           ["payment", "transaction", "billing", "invoice", "stripe"]),
    ("kyc",               ["kyc", "identity", "verify", "onboard"]),
    ("reconciliation",    ["reconcil", "settlement", "balance", "ledger"]),
]


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _cron_to_hours(expression: str) -> float | None:
    """Approximate the interval of a cron expression in hours."""
    parts = expression.strip().split()
    if len(parts) != 5:
        return None
    _min, hour, _dom, _mon, _dow = parts
    # */N patterns
    if hour.startswith("*/"):
        try:
            return float(hour[2:])
        except ValueError:
            pass
    # Hourly (0 * * * *)
    if hour == "*" and _min not in ("*",):
        return 1.0
    # Daily (0 0 * * *)
    if hour.isdigit() and _dom == "*" and _dow == "*":
        return 24.0
    return None


def _iso_to_hours(text: str) -> float | None:
    """Convert ISO 8601 duration to hours (rough, no months/years)."""
    total = 0.0
    for m in _ISO_DURATION_PATTERNS[0].finditer(text):
        val, unit = float(m.group(1)), m.group(2).upper()
        if unit == "H":
            total += val
        elif unit == "D":
            total += val * 24
        elif unit == "M":
            total += val / 60
        elif unit == "S":
            total += val / 3600
    return total if total > 0 else None


def _match_step(text_lower: str, step_names: list[str]) -> list[str]:
    """Return step names whose keywords appear in text."""
    matched = []
    for step_name in step_names:
        key = step_name.lower()
        # Direct name match
        if key in text_lower:
            matched.append(step_name)
            continue
        # Keyword heuristic
        for (category, keywords) in _STEP_KEYWORDS:
            if any(kw in text_lower for kw in keywords):
                if any(kw in key or kw in category for kw in keywords):
                    if category in key or key in category:
                        matched.append(step_name)
                        break
    return matched


# ─── Main extractor ──────────────────────────────────────────────────────────

def extract_code_signals(
    context_chunks: list[dict[str, Any]],
    step_names: list[str],
) -> dict[str, dict]:
    """
    Scan context document chunks for timing signals.

    Returns:
        {
          "<step_name_lower>": {
            "process_time_hrs": float | None,
            "wait_time_hrs": float | None,
            "source": str,
            "confidence": float,
            "evidence": str,
          },
          ...
        }
    """
    signals: dict[str, dict] = {}

    for chunk in context_chunks:
        content = chunk.get("content", "")
        if not content:
            continue
        content_lower = content.lower()

        # ── Timeouts ────────────────────────────────────────────────────────
        for pattern in _TIMEOUT_PATTERNS:
            for m in pattern.finditer(content):
                raw = float(m.group(1))
                # Heuristic: if value > 10000, assume ms; else seconds
                hours = raw / 3_600_000 if raw > 10_000 else raw / 3_600
                matched_steps = _match_step(content_lower, step_names)
                for step in matched_steps:
                    _merge_signal(signals, step, "process_time_hrs", hours,
                                  "code_signals", 0.7, f"timeout={m.group(0)}")

        # ── SLA constants ───────────────────────────────────────────────────
        for pattern in _SLA_PATTERNS:
            for m in pattern.finditer(content):
                raw = float(m.group(1))
                pat_str = pattern.pattern.lower()
                if "minute" in pat_str or "min" in pat_str:
                    hours = raw / 60
                elif "ms" in pat_str or "millis" in pat_str:
                    hours = raw / 3_600_000
                else:
                    hours = raw  # assumed hours
                matched_steps = _match_step(content_lower, step_names)
                for step in matched_steps:
                    _merge_signal(signals, step, "wait_time_hrs", hours,
                                  "code_signals", 0.75, f"sla={m.group(0)}")

        # ── Cron schedules ──────────────────────────────────────────────────
        for pattern in _CRON_PATTERNS:
            for m in pattern.finditer(content):
                h = _cron_to_hours(m.group(1))
                if h is not None:
                    matched_steps = _match_step(content_lower, step_names)
                    for step in matched_steps:
                        _merge_signal(signals, step, "wait_time_hrs", h,
                                      "code_signals", 0.8, f"cron={m.group(0)}")

        # ── ISO durations ───────────────────────────────────────────────────
        h = _iso_to_hours(content)
        if h is not None:
            matched_steps = _match_step(content_lower, step_names)
            for step in matched_steps:
                _merge_signal(signals, step, "wait_time_hrs", h,
                              "code_signals", 0.7, "ISO-8601 duration")

        # ── Retry delays ────────────────────────────────────────────────────
        for pattern in _RETRY_PATTERNS:
            for m in pattern.finditer(content):
                raw = float(m.group(1))
                hours = raw / 3_600_000 if raw > 10_000 else raw / 3_600
                matched_steps = _match_step(content_lower, step_names)
                for step in matched_steps:
                    _merge_signal(signals, step, "wait_time_hrs", hours,
                                  "code_signals", 0.6, f"retry_delay={m.group(0)}")

    logger.info(
        "Code signal extraction: %d signals found across %d chunks",
        len(signals),
        len(context_chunks),
    )
    return signals


def _merge_signal(
    signals: dict,
    step_name: str,
    field: str,
    value: float,
    source: str,
    confidence: float,
    evidence: str,
) -> None:
    """Keep the highest-confidence signal per step+field."""
    key = step_name.lower()
    if key not in signals:
        signals[key] = {
            "process_time_hrs": None,
            "wait_time_hrs": None,
            "source": source,
            "confidence": 0.0,
            "evidence": [],
        }
    existing_conf = signals[key].get("confidence", 0.0)
    # Take new value if confidence is higher, or accumulate wait time
    if confidence > existing_conf or signals[key][field] is None:
        signals[key][field] = round(value, 4)
        signals[key]["confidence"] = max(existing_conf, confidence)
        signals[key]["source"] = source
    signals[key]["evidence"].append(evidence)
