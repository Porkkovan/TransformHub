"""
Utility: save agent output summaries as AGENT_OUTPUT ContextDocuments.

When called at the end of an agent's persist_results node, this function
writes a structured summary into the context_documents + context_embeddings
tables with category='AGENT_OUTPUT'. Subsequent agents (e.g. product roadmap,
backlog) can then retrieve prior analysis via semantic search — enabling
full cross-agent context chaining without manual uploads.
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any

from app.core.database import db_pool

logger = logging.getLogger(__name__)

# Max chars for the text summary stored per agent output doc
_MAX_SUMMARY_CHARS = 8000


def _build_discovery_summary(output: dict[str, Any], org_name: str) -> str:
    products = output.get("products_created", [])
    caps = output.get("capabilities_count", 0)
    funcs = output.get("functionalities_count", 0)
    segment = output.get("business_segment", "")
    lines = [
        f"# Discovery Agent Output — {org_name}",
        f"Business Segment: {segment}" if segment else "",
        f"Products discovered: {output.get('products_count', len(products))}",
        f"Capabilities: {caps}",
        f"Functionalities: {funcs}",
        "",
        "## Products",
    ]
    for p in products[:30]:
        name = p.get("name", p) if isinstance(p, dict) else p
        lines.append(f"- {name}")
    return "\n".join(l for l in lines if l is not None)


def _build_vsm_summary(output: dict[str, Any], org_name: str) -> str:
    metrics = output.get("metrics", [])
    lines = [
        f"# VSM Agent Output — {org_name}",
        f"Product: {output.get('product_name', '')}",
        f"Capabilities analysed: {output.get('capabilities_count', 0)}",
        "",
        "## VSM Metrics per Capability",
    ]
    for m in metrics[:20]:
        cap = m.get("capability", "")
        pt = m.get("process_time", "?")
        wt = m.get("wait_time", "?")
        fe = m.get("flow_efficiency", "?")
        cls_ = m.get("classification", "")
        lines.append(f"- {cap}: PT={pt}h, WT={wt}h, FE={fe}%, {cls_}")
    return "\n".join(lines)


def _build_future_state_summary(output: dict[str, Any], org_name: str) -> str:
    caps = output.get("capabilities", [])
    lines = [
        f"# Future State Vision Output — {org_name}",
        f"Products analysed: {output.get('products_count', 0)}",
        f"Future capabilities generated: {len(caps)}",
        "",
        "## Future Capabilities with Projected Metrics",
    ]
    for c in caps[:25]:
        name = c.get("name", "")
        cat = c.get("category", "")
        impact = c.get("business_impact", "")
        roi = c.get("estimated_roi_pct", "")
        prod = c.get("product_name", "")
        roi_str = f", ROI ~{roi}%" if roi else ""
        prod_str = f" [{prod}]" if prod else ""
        lines.append(f"- {name}{prod_str} ({cat}, impact={impact}{roi_str})")
        # Include projected_metrics if available (benchmark-grounded)
        pm = c.get("projected_metrics")
        if pm and isinstance(pm, dict):
            src = pm.get("benchmark_source", "")
            src_str = f" [source: {src}]" if src else ""
            fe = pm.get("flow_efficiency_pct", {})
            pt = pm.get("process_time_hrs", {})
            if isinstance(fe, dict):
                lines.append(
                    f"  Projected FE: conservative={fe.get('conservative','?')}%"
                    f" / expected={fe.get('expected','?')}%"
                    f" / optimistic={fe.get('optimistic','?')}%{src_str}"
                )
            if isinstance(pt, dict):
                lines.append(
                    f"  Projected PT: conservative={pt.get('conservative','?')}h"
                    f" / expected={pt.get('expected','?')}h"
                    f" / optimistic={pt.get('optimistic','?')}h"
                )
    vstreams = output.get("future_value_streams", [])
    if vstreams:
        lines += ["", "## Future Value Stream Gains"]
        for vs in vstreams[:10]:
            prod = vs.get("product_name", "")
            eff = vs.get("efficiency_gain_pct", "")
            lines.append(f"- {prod}: {eff}% efficiency gain" if eff else f"- {prod}")
    return "\n".join(lines)


def _build_risk_summary(output: dict[str, Any], org_name: str) -> str:
    risks = output.get("risks", [])
    lines = [
        f"# Risk & Compliance Agent Output — {org_name}",
        f"Risks identified: {len(risks)}",
        f"Critical risks: {output.get('critical_count', 0)}",
        "",
        "## Top Risks",
    ]
    for r in risks[:15]:
        name = r.get("name", r.get("risk", ""))
        level = r.get("level", r.get("severity", ""))
        blocked = " [BLOCKS TRANSFORMATION]" if r.get("transition_blocked") else ""
        lines.append(f"- {name} ({level}){blocked}")
    return "\n".join(lines)


def _build_product_transformation_summary(output: dict[str, Any], org_name: str) -> str:
    lines = [
        f"# Product Transformation Agent Output — {org_name}",
        f"Products assessed: {output.get('readiness_scores_count', 0)}",
        f"Transformation approved: {output.get('transformation_approved', False)}",
        f"Blockers: {output.get('blockers_count', 0)}",
    ]
    plans = output.get("transformation_plans", [])
    if plans:
        lines += ["", "## Transformation Plans"]
        for p in plans[:10]:
            prod = p.get("product_name", "")
            score = p.get("readiness_score", "")
            weeks = p.get("estimated_total_weeks", "")
            lines.append(f"- {prod}: readiness={score}/10, duration={weeks}w")
    return "\n".join(lines)


_BUILDERS = {
    "discovery":             _build_discovery_summary,
    "lean_vsm":              _build_vsm_summary,
    "future_state_vision":   _build_future_state_summary,
    "risk_compliance":       _build_risk_summary,
    "product_transformation": _build_product_transformation_summary,
}


async def save_agent_context_doc(
    agent_type: str,
    organization_id: str,
    org_name: str,
    output: dict[str, Any],
) -> None:
    """
    Persist a structured text summary of `output` as a ContextDocument
    with category='AGENT_OUTPUT'. Safe to call even if embeddings fail.

    This is fire-and-forget at the end of persist_results — exceptions are
    caught and logged but never re-raised so they don't affect agent output.
    """
    builder = _BUILDERS.get(agent_type)
    if not builder:
        return  # Agent type not tracked

    try:
        summary = builder(output, org_name)
        if not summary or len(summary.strip()) < 30:
            return

        summary = summary[:_MAX_SUMMARY_CHARS]
        doc_id = str(uuid.uuid4())
        file_name = f"{agent_type}_output_{doc_id[:8]}.txt"

        # Upsert: delete previous AGENT_OUTPUT doc for same agent type in this org,
        # then insert fresh one. Keeps the table tidy (1 doc per agent per org).
        await db_pool.execute(
            """
            DELETE FROM context_documents
            WHERE organization_id = $1
              AND category = 'AGENT_OUTPUT'
              AND file_name LIKE $2
            """,
            organization_id,
            f"{agent_type}_output_%.txt",
        )

        await db_pool.execute(
            """
            INSERT INTO context_documents
              (id, organization_id, file_name, file_type, file_size, file_path,
               category, sub_category, status, chunk_count, created_at, updated_at)
            VALUES ($1,$2,$3,'txt',$4,$5,'AGENT_OUTPUT',$6,'INDEXED',1,NOW(),NOW())
            """,
            doc_id, organization_id, file_name, len(summary),
            f"agent-output://{agent_type}", agent_type,
        )

        embed_id = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO context_embeddings
              (id, context_document_id, organization_id, chunk_index, content, created_at)
            VALUES ($1,$2,$3,0,$4,NOW())
            """,
            embed_id, doc_id, organization_id, summary,
        )

        logger.info(
            "Saved AGENT_OUTPUT context doc for %s / org=%s (%d chars)",
            agent_type, organization_id, len(summary),
        )

    except Exception as exc:
        logger.warning("save_agent_context_doc failed (non-fatal): %s", exc)
