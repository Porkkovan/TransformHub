"""Tests for agent versioning hash computation."""

import pytest
from app.services.versioning import compute_hash


def test_compute_hash_deterministic():
    data = {"prompt": "Analyze the code", "system": "You are an expert"}
    h1 = compute_hash(data)
    h2 = compute_hash(data)
    assert h1 == h2
    assert isinstance(h1, str)
    assert len(h1) == 16  # SHA-256 hex truncated to 16 chars


def test_compute_hash_key_order_independent():
    d1 = {"a": 1, "b": 2, "c": 3}
    d2 = {"c": 3, "a": 1, "b": 2}
    assert compute_hash(d1) == compute_hash(d2)


def test_compute_hash_different_values_differ():
    d1 = {"prompt": "hello"}
    d2 = {"prompt": "world"}
    assert compute_hash(d1) != compute_hash(d2)


def test_compute_hash_nested_objects():
    d1 = {"config": {"nodes": ["a", "b"], "edges": [["a", "b"]]}}
    d2 = {"config": {"nodes": ["a", "b"], "edges": [["a", "b"]]}}
    assert compute_hash(d1) == compute_hash(d2)


def test_compute_hash_empty_dict():
    h = compute_hash({})
    assert isinstance(h, str)
    assert len(h) == 16
