"""Tests for code chunking in the embeddings service."""

import pytest
from app.services.embeddings import chunk_code


def test_chunk_code_single_chunk():
    code = "print('hello')"
    chunks = chunk_code(code, chunk_size=500, overlap=50)
    assert len(chunks) == 1
    assert chunks[0] == code


def test_chunk_code_multiple_chunks():
    # Create code that will exceed one chunk
    lines = [f"x_{i} = {i}" for i in range(200)]
    code = "\n".join(lines)
    chunks = chunk_code(code, chunk_size=100, overlap=10)
    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk) > 0


def test_chunk_code_overlap():
    lines = [f"line_{i} = {i}" for i in range(100)]
    code = "\n".join(lines)
    chunks = chunk_code(code, chunk_size=50, overlap=10)
    assert len(chunks) >= 2
    if len(chunks) >= 2:
        assert len(chunks[0]) > 0
        assert len(chunks[1]) > 0


def test_chunk_code_empty_input():
    chunks = chunk_code("", chunk_size=500, overlap=50)
    assert len(chunks) <= 1


def test_chunk_code_preserves_all_content():
    code = "def foo():\n    return 42\n\ndef bar():\n    return 99\n"
    chunks = chunk_code(code, chunk_size=500, overlap=0)
    combined = "".join(chunks)
    assert combined.strip() == code.strip()
