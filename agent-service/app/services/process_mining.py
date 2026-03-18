"""
P4: Lightweight process mining from event logs.

Accepts event log data (CSV or list of dicts) in standard XES-compatible format:
  case_id, activity, timestamp, resource (optional)

Computes:
  - Per-activity average cycle time (start→complete duration)
  - Transition frequencies (predecessor → activity)
  - Bottleneck identification (activities with longest wait between events)
  - Process conformance: maps discovered activities → VSM step names

This is intentionally lightweight — full process mining (Petri nets, alignment)
requires ProM/pm4py. This service provides the 80% value for VSM augmentation
without the dependency.
"""

from __future__ import annotations

import csv
import io
import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ── Data structures ───────────────────────────────────────────────────────────


class EventLogParser:
    """Parse raw event log CSV into structured events."""

    REQUIRED_COLUMNS = {"case_id", "activity", "timestamp"}
    TIMESTAMP_FORMATS = [
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%d/%m/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M:%S",
    ]

    def parse_csv(self, csv_text: str) -> list[dict]:
        """Parse CSV event log. Returns list of event dicts with parsed timestamps."""
        reader = csv.DictReader(io.StringIO(csv_text.strip()))
        if not reader.fieldnames:
            raise ValueError("Empty CSV")

        columns = {c.strip().lower() for c in reader.fieldnames}
        missing = self.REQUIRED_COLUMNS - columns
        if missing:
            raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")

        # Normalize column names to lowercase
        events = []
        for row in reader:
            normalized = {k.strip().lower(): v.strip() for k, v in row.items()}
            ts = self._parse_timestamp(normalized.get("timestamp", ""))
            if ts is None:
                continue
            events.append({
                "case_id":   normalized.get("case_id", ""),
                "activity":  normalized.get("activity", "").strip(),
                "timestamp": ts,
                "resource":  normalized.get("resource", normalized.get("user", "")),
                "lifecycle": normalized.get("lifecycle", normalized.get("event_type", "complete")).lower(),
            })

        return sorted(events, key=lambda e: e["timestamp"])

    def parse_dicts(self, events: list[dict]) -> list[dict]:
        """Normalize a list of event dicts."""
        result = []
        for row in events:
            normalized = {k.strip().lower(): str(v).strip() for k, v in row.items()}
            ts = self._parse_timestamp(normalized.get("timestamp", ""))
            if ts is None:
                continue
            result.append({
                "case_id":   normalized.get("case_id", ""),
                "activity":  normalized.get("activity", "").strip(),
                "timestamp": ts,
                "resource":  normalized.get("resource", ""),
                "lifecycle": normalized.get("lifecycle", "complete").lower(),
            })
        return sorted(result, key=lambda e: e["timestamp"])

    def _parse_timestamp(self, raw: str) -> Optional[datetime]:
        for fmt in self.TIMESTAMP_FORMATS:
            try:
                return datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                continue
        # Try ISO format with timezone
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            pass
        return None


# ── Analysis ──────────────────────────────────────────────────────────────────


def _group_by_case(events: list[dict]) -> dict[str, list[dict]]:
    cases: dict[str, list[dict]] = defaultdict(list)
    for e in events:
        cases[e["case_id"]].append(e)
    return dict(cases)


def compute_activity_stats(events: list[dict]) -> dict[str, dict]:
    """
    Compute per-activity statistics from event log.

    For each activity, returns:
      - avg_duration_hrs: average time from first to last event for the activity within a case
      - frequency: total occurrence count
      - cases_involved: number of distinct cases
      - avg_wait_before_hrs: average idle time between previous activity and this one
    """
    cases = _group_by_case(events)

    # Per-activity metrics
    durations_by_activity: dict[str, list[float]] = defaultdict(list)
    waits_by_activity: dict[str, list[float]] = defaultdict(list)
    case_counts: dict[str, set] = defaultdict(set)
    frequencies: dict[str, int] = defaultdict(int)

    for case_id, case_events in cases.items():
        sorted_events = sorted(case_events, key=lambda e: e["timestamp"])
        prev_end: Optional[datetime] = None

        # Group events by activity within the case (for start/complete pairs)
        activity_events: dict[str, list[datetime]] = defaultdict(list)
        for e in sorted_events:
            activity_events[e["activity"]].append(e["timestamp"])

        # Process in sequence
        seen_activities: list[tuple[str, datetime]] = []  # (activity, last_ts)
        for e in sorted_events:
            act = e["activity"]
            ts  = e["timestamp"]
            frequencies[act] += 1
            case_counts[act].add(case_id)

            # Wait before this activity (time since last different activity ended)
            if seen_activities:
                last_act, last_ts = seen_activities[-1]
                if last_act != act:
                    wait_hrs = (ts - last_ts).total_seconds() / 3600
                    if wait_hrs >= 0:
                        waits_by_activity[act].append(wait_hrs)

            seen_activities.append((act, ts))

        # Duration = time from first to last occurrence per activity per case
        for act, timestamps in activity_events.items():
            if len(timestamps) >= 2:
                dur_hrs = (max(timestamps) - min(timestamps)).total_seconds() / 3600
                durations_by_activity[act].append(dur_hrs)

    all_activities = set(frequencies.keys())
    result = {}
    for act in all_activities:
        durs  = durations_by_activity.get(act, [])
        waits = waits_by_activity.get(act, [])
        result[act] = {
            "frequency":         frequencies[act],
            "cases_involved":    len(case_counts[act]),
            "avg_duration_hrs":  round(sum(durs) / len(durs), 3) if durs else None,
            "avg_wait_before_hrs": round(sum(waits) / len(waits), 3) if waits else None,
        }

    return result


def compute_transitions(events: list[dict]) -> list[dict]:
    """Compute activity transition frequencies (process flow discovery)."""
    cases = _group_by_case(events)
    transitions: dict[tuple, int] = defaultdict(int)

    for case_events in cases.values():
        sorted_events = sorted(case_events, key=lambda e: e["timestamp"])
        for i in range(len(sorted_events) - 1):
            src = sorted_events[i]["activity"]
            dst = sorted_events[i + 1]["activity"]
            if src != dst:
                transitions[(src, dst)] += 1

    return [
        {"from": src, "to": dst, "count": cnt}
        for (src, dst), cnt in sorted(transitions.items(), key=lambda x: -x[1])
    ]


def map_to_vsm_steps(
    activity_stats: dict[str, dict],
    step_names: list[str],
    min_similarity: float = 0.2,
) -> dict[str, dict]:
    """
    Map discovered process activities to VSM step names using token similarity.

    Returns {step_name: {activity, avg_duration_hrs, avg_wait_before_hrs, confidence}}
    """
    def _similarity(a: str, b: str) -> float:
        aa = set(a.lower().replace(r"[^a-z0-9]", " ").split())
        bb = set(b.lower().replace(r"[^a-z0-9]", " ").split())
        if not aa or not bb:
            return 0.0
        intersection = aa & bb
        meaningful = {w for w in intersection if len(w) > 2}
        return len(meaningful) / max(len(aa), len(bb))

    mapping: dict[str, dict] = {}

    for step in step_names:
        best_score = 0.0
        best_activity = None
        best_stats: dict = {}

        for activity, stats in activity_stats.items():
            score = _similarity(step, activity)
            if score > best_score:
                best_score = score
                best_activity = activity
                best_stats = stats

        if best_activity and best_score >= min_similarity:
            mapping[step] = {
                "matched_activity":    best_activity,
                "similarity_score":    round(best_score, 3),
                "avg_duration_hrs":    best_stats.get("avg_duration_hrs"),
                "avg_wait_before_hrs": best_stats.get("avg_wait_before_hrs"),
                "frequency":           best_stats.get("frequency", 0),
                "confidence":          min(0.5 + best_score * 0.5 + (0.1 if best_stats.get("frequency", 0) > 10 else 0), 0.95),
            }

    return mapping


def identify_bottlenecks(
    activity_stats: dict[str, dict],
    top_n: int = 5,
) -> list[dict]:
    """
    Identify process bottlenecks: activities with highest wait time before them.
    These are steps where work queues up.
    """
    candidates = [
        {
            "activity":          act,
            "avg_wait_before_hrs": stats["avg_wait_before_hrs"],
            "frequency":         stats["frequency"],
            "bottleneck_score":  (stats["avg_wait_before_hrs"] or 0) * (stats["frequency"] or 1),
        }
        for act, stats in activity_stats.items()
        if stats.get("avg_wait_before_hrs") is not None
    ]
    candidates.sort(key=lambda x: -x["bottleneck_score"])
    return candidates[:top_n]


# ── Public API ────────────────────────────────────────────────────────────────


class ProcessMiningService:
    """
    High-level process mining service.

    Accepts raw event log data (CSV text or list of dicts) and returns
    a structured process model with VSM step mapping.
    """

    def __init__(self) -> None:
        self._parser = EventLogParser()

    def analyze(
        self,
        event_log: str | list[dict],
        vsm_step_names: Optional[list[str]] = None,
        *,
        top_n_bottlenecks: int = 5,
    ) -> dict[str, Any]:
        """
        Run full process mining analysis.

        Args:
            event_log: CSV text string or list of event dicts
            vsm_step_names: if provided, map discovered activities to these names
            top_n_bottlenecks: number of top bottleneck activities to return

        Returns dict with:
          - events_parsed: int
          - cases: int
          - activities: dict of activity stats
          - transitions: list of flow edges
          - bottlenecks: list of top bottleneck activities
          - vsm_mapping: dict mapping step names to matched activities (if step_names given)
          - timing_source: "process_mining"
        """
        if isinstance(event_log, str):
            events = self._parser.parse_csv(event_log)
        else:
            events = self._parser.parse_dicts(event_log)

        if not events:
            return {"error": "No valid events parsed from input"}

        cases = len({e["case_id"] for e in events})
        activity_stats  = compute_activity_stats(events)
        transitions     = compute_transitions(events)
        bottlenecks     = identify_bottlenecks(activity_stats, top_n=top_n_bottlenecks)

        result: dict[str, Any] = {
            "timing_source":   "process_mining",
            "events_parsed":   len(events),
            "cases":           cases,
            "activities":      activity_stats,
            "transitions":     transitions[:20],  # top 20 most frequent flows
            "bottlenecks":     bottlenecks,
        }

        if vsm_step_names:
            result["vsm_mapping"] = map_to_vsm_steps(activity_stats, vsm_step_names)

        logger.info(
            "Process mining complete: %d events, %d cases, %d activities, %d transitions",
            len(events), cases, len(activity_stats), len(transitions),
        )
        return result


# Module-level singleton
process_mining_service = ProcessMiningService()
