import hashlib
import json
from typing import Any, Optional


def compute_payload_hash(payload: Any, previous_hash: Optional[str] = None) -> str:
    payload_str = json.dumps(payload, sort_keys=True, default=str)
    if previous_hash:
        payload_str += previous_hash
    return hashlib.sha256(payload_str.encode("utf-8")).hexdigest()


def verify_chain_integrity(entries: list[dict]) -> tuple[bool, Optional[str]]:
    for i, entry in enumerate(entries):
        expected_previous = entries[i - 1]["payload_hash"] if i > 0 else None
        if entry.get("previous_hash") != expected_previous:
            return False, f"Chain broken at entry {entry['id']}: expected previous_hash={expected_previous}"
        recomputed = compute_payload_hash(entry["payload"], expected_previous)
        if recomputed != entry["payload_hash"]:
            return False, f"Hash mismatch at entry {entry['id']}: stored={entry['payload_hash']}, computed={recomputed}"
    return True, None
