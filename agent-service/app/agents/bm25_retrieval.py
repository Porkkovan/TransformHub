"""
BM25 keyword-based retrieval over contextDocuments already injected into input_data.

This module re-ranks the semantic search results passed by the Next.js execute route
by computing BM25 scores against the agent's prompt keywords. Chunks that appear in
both the semantic search and keyword search float to the top.

Usage (in any agent node that builds a prompt):
    from app.agents.bm25_retrieval import bm25_rerank

    context_docs = input_data.get("contextDocuments", [])
    if context_docs:
        context_docs = bm25_rerank(context_docs, query_keywords)
        # Then pass context_docs (already re-ranked) to format_context_section()
        input_data = {**input_data, "contextDocuments": context_docs}
"""

from __future__ import annotations

import math
import re
from typing import Any


def _tokenize(text: str) -> list[str]:
    """Lower-case, strip punctuation, split on whitespace."""
    return re.findall(r"\b[a-z]{2,}\b", text.lower())


def _compute_bm25_scores(
    docs: list[dict[str, Any]],
    query_tokens: list[str],
    k1: float = 1.5,
    b: float = 0.75,
) -> list[float]:
    """
    Classic BM25 scoring.

    k1: term saturation parameter (1.2–2.0 typical)
    b:  length normalisation (0 = none, 1 = full)
    """
    if not query_tokens or not docs:
        return [0.0] * len(docs)

    tokenized = [_tokenize(d.get("content", "")) for d in docs]
    doc_lengths = [len(t) for t in tokenized]
    avg_dl = sum(doc_lengths) / max(len(doc_lengths), 1)
    N = len(docs)

    # IDF per query term
    idf: dict[str, float] = {}
    for term in set(query_tokens):
        df = sum(1 for t in tokenized if term in t)
        idf[term] = math.log((N - df + 0.5) / (df + 0.5) + 1)

    scores: list[float] = []
    for tokens, dl in zip(tokenized, doc_lengths):
        tf_map: dict[str, int] = {}
        for tok in tokens:
            tf_map[tok] = tf_map.get(tok, 0) + 1
        score = 0.0
        for term in query_tokens:
            tf = tf_map.get(term, 0)
            numerator = tf * (k1 + 1)
            denominator = tf + k1 * (1 - b + b * dl / max(avg_dl, 1))
            score += idf.get(term, 0) * (numerator / max(denominator, 1e-9))
        scores.append(score)

    return scores


def bm25_rerank(
    context_docs: list[dict[str, Any]],
    query: str,
    top_n: int = 20,
    semantic_weight: float = 0.5,
    bm25_weight: float = 0.5,
) -> list[dict[str, Any]]:
    """
    Re-rank `context_docs` using a hybrid of BM25 score and original semantic rank.

    The semantic rank is approximated by the position in the list (docs earlier
    in the list scored higher by cosine similarity).

    Returns the top_n documents sorted by combined score.
    """
    if not context_docs:
        return context_docs

    query_tokens = _tokenize(query)
    if not query_tokens:
        return context_docs[:top_n]

    bm25_raw = _compute_bm25_scores(context_docs, query_tokens)
    max_bm25 = max(bm25_raw) or 1.0

    n = len(context_docs)
    combined: list[tuple[float, int]] = []
    for i, bm25_score in enumerate(bm25_raw):
        # Normalised BM25 score (0→1)
        norm_bm25 = bm25_score / max_bm25
        # Semantic score: earlier = higher (linear decay from 1 to 0)
        norm_semantic = 1.0 - (i / max(n - 1, 1))
        final = semantic_weight * norm_semantic + bm25_weight * norm_bm25
        combined.append((final, i))

    combined.sort(key=lambda x: -x[0])
    return [context_docs[i] for _, i in combined[:top_n]]


def bm25_rerank_for_agent(
    input_data: dict[str, Any],
    query_keywords: str,
    top_n: int = 20,
) -> dict[str, Any]:
    """
    Convenience wrapper: re-ranks contextDocuments in input_data and returns
    updated input_data. Safe to call even if contextDocuments is absent.

    Usage in an agent node:
        input_data = bm25_rerank_for_agent(input_data, "process time wait time flow efficiency")
    """
    docs = input_data.get("contextDocuments", [])
    if not docs:
        return input_data
    reranked = bm25_rerank(docs, query_keywords, top_n=top_n)
    return {**input_data, "contextDocuments": reranked}
