"""Helper to extract organization context from agent input_data."""

from typing import Any


def get_org_context(input_data: dict[str, Any]) -> dict[str, Any]:
    """Extract organization context from input_data with sensible defaults."""
    org = input_data.get("organization", {})
    return {
        "name": org.get("name", "Enterprise"),
        "industry_type": org.get("industry_type", "technology"),
        "competitors": org.get("competitors", []),
        "business_segments": org.get("business_segments", []),
        "regulatory_frameworks": org.get("regulatory_frameworks", []),
        "personas": org.get("personas", []),
    }


def format_frameworks(frameworks: list[str]) -> str:
    """Format regulatory frameworks for prompt injection."""
    if not frameworks:
        return "applicable industry regulations"
    return ", ".join(frameworks)


def format_competitors(competitors: list[str]) -> str:
    """Format competitor list for prompt injection."""
    if not competitors:
        return "leading industry competitors"
    return ", ".join(competitors)


def format_personas(personas: list[dict]) -> str:
    """Format persona list for prompt injection."""
    if not personas:
        return (
            "- FRONT_OFFICE / Business User: client-facing functions\n"
            "- MIDDLE_OFFICE / Compliance Officer: risk, compliance, oversight\n"
            "- BACK_OFFICE / Operations Analyst: operations, maintenance"
        )
    lines = []
    for p in personas:
        ptype = p.get("type", "UNKNOWN")
        pname = p.get("name", "User")
        resps = p.get("responsibilities", [])
        resp_str = ", ".join(resps) if resps else "general duties"
        lines.append(f"- {ptype} / {pname}: {resp_str}")
    return "\n".join(lines)


def org_description(org: dict[str, Any]) -> str:
    """Build a short org description string for prompts."""
    name = org.get("name", "Enterprise")
    industry = org.get("industry_type", "technology")
    return f"{name} ({industry})"


# ── Category priority tables per agent type ───────────────────────────────────
# Each entry: (category_filter, budget_fraction, section_label, max_docs)
# category_filter="" means "all remaining categories not already claimed"
_AGENT_CATEGORY_PRIORITIES: dict[str, list[tuple[str, float, str, int]]] = {
    "future_state_vision": [
        ("TRANSFORMATION_CASE_STUDIES", 0.28, "TRANSFORMATION CASE STUDIES",  8),
        ("VSM_BENCHMARKS",              0.18, "VSM BENCHMARK DATA",            6),
        ("AGENT_OUTPUT",                0.22, "PRIOR AGENT ANALYSIS",          8),
        ("ARCHITECTURE_STANDARDS",      0.12, "ARCHITECTURE STANDARDS",        4),
        ("",                            0.20, "UPLOADED DOCUMENTS",           10),
    ],
    "lean_vsm": [
        ("VSM_BENCHMARKS",              0.38, "VSM BENCHMARK DATA",           10),
        ("TRANSFORMATION_CASE_STUDIES", 0.18, "TRANSFORMATION CASE STUDIES",   5),
        ("AGENT_OUTPUT",                0.24, "PRIOR AGENT ANALYSIS",          8),
        ("",                            0.20, "UPLOADED DOCUMENTS",            8),
    ],
    "product_transformation": [
        ("AGENT_OUTPUT",                0.32, "PRIOR AGENT ANALYSIS",          8),
        ("TRANSFORMATION_CASE_STUDIES", 0.25, "TRANSFORMATION CASE STUDIES",   6),
        ("VSM_BENCHMARKS",              0.13, "VSM BENCHMARK DATA",            4),
        ("",                            0.30, "UPLOADED DOCUMENTS",           10),
    ],
    "backlog_okr": [
        ("AGENT_OUTPUT",                0.38, "PRIOR AGENT ANALYSIS",         10),
        ("TRANSFORMATION_CASE_STUDIES", 0.22, "TRANSFORMATION CASE STUDIES",   5),
        ("",                            0.40, "UPLOADED DOCUMENTS",           10),
    ],
    "discovery": [
        ("ARCHITECTURE_STANDARDS",      0.22, "ARCHITECTURE STANDARDS",        6),
        ("AGENT_OUTPUT",                0.28, "PRIOR AGENT ANALYSIS",          8),
        ("",                            0.50, "UPLOADED DOCUMENTS",           15),
    ],
    "risk_compliance": [
        ("ARCHITECTURE_STANDARDS",      0.18, "ARCHITECTURE STANDARDS",        5),
        ("AGENT_OUTPUT",                0.32, "PRIOR AGENT ANALYSIS",         10),
        ("",                            0.50, "UPLOADED DOCUMENTS",           12),
    ],
    "market_intelligence": [
        ("TRANSFORMATION_CASE_STUDIES", 0.30, "TRANSFORMATION CASE STUDIES",   8),
        ("AGENT_OUTPUT",                0.20, "PRIOR AGENT ANALYSIS",          6),
        ("",                            0.50, "UPLOADED DOCUMENTS",           12),
    ],
}
_DEFAULT_PRIORITIES: list[tuple[str, float, str, int]] = [
    ("AGENT_OUTPUT", 0.30, "PRIOR AGENT ANALYSIS",  8),
    ("",             0.70, "UPLOADED DOCUMENTS",    15),
]

# Per-agent integration budget fractions (proportion of max_chars given to
# "integration" category docs — Jira / Confluence / ADO synced content).
# Discovery gets a larger share because integration data is the primary
# source for L2 capability and L3 functionality naming.
_INTEGRATION_BUDGET_FRACTIONS: dict[str, float] = {
    "discovery":           0.28,
    "future_state_vision": 0.15,
    "lean_vsm":            0.15,
    "product_transformation": 0.15,
    "backlog_okr":         0.18,
}


def format_context_section(
    input_data: dict[str, Any],
    max_chars: int = 12000,
    agent_type: str = "",
) -> str:
    """Format uploaded context documents and application portfolio for prompt injection.

    Budget is 12 000 chars by default (3× the previous limit) and allocation is
    category-aware: benchmark data, case studies, and prior agent outputs are
    surfaced first for the agents that benefit most from them.

    Returns an empty string when no context is available.
    """
    sections: list[str] = []
    priorities = _AGENT_CATEGORY_PRIORITIES.get(agent_type, _DEFAULT_PRIORITIES)

    # ── 1. Integration docs (Jira/Confluence etc.) ────────────────────────────
    context_docs = input_data.get("contextDocuments", [])
    if context_docs:
        integration_docs = [d for d in context_docs if d.get("category") == "integration"]
        if integration_docs:
            int_fraction = _INTEGRATION_BUDGET_FRACTIONS.get(agent_type, 0.12)
            int_budget = int(max_chars * int_fraction)
            int_lines: list[str] = []
            chars_used = 0
            for doc in integration_docs[:5]:
                content = (doc.get("metadata") or {}).get("content", doc.get("content", "")).strip()
                sub_cat = doc.get("subCategory", doc.get("sub_category", ""))
                title = doc.get("title", doc.get("fileName", doc.get("file_name", "External Data")))
                if not content:
                    continue
                snippet = f"### {title} ({sub_cat})\n{content[:2000]}"
                if chars_used + len(snippet) > int_budget:
                    break
                int_lines.append(snippet)
                chars_used += len(snippet)
            if int_lines:
                sections.append(
                    "## External Integration Data\n"
                    "Imported from connected systems (Jira, Confluence, Azure DevOps, Notion, ServiceNow). "
                    "Use to inform current-state analysis and prioritise existing initiatives:\n\n"
                    + "\n\n".join(int_lines)
                )

        # ── 2. Category-prioritised doc injection ─────────────────────────────
        uploaded_docs = [d for d in context_docs if d.get("category") != "integration"]
        int_fraction = _INTEGRATION_BUDGET_FRACTIONS.get(agent_type, 0.12)
        remaining_budget = int(max_chars * (1.0 - int_fraction))

        for cat_filter, fraction, label, max_docs in priorities:
            budget = int(remaining_budget * fraction)
            if cat_filter:
                matching = [
                    d for d in uploaded_docs
                    if d.get("category", "").upper() == cat_filter
                ]
            else:
                used_cats = {p[0].upper() for p in priorities if p[0]}
                matching = [
                    d for d in uploaded_docs
                    if d.get("category", "").upper() not in used_cats
                ]

            if not matching:
                continue

            doc_lines: list[str] = []
            chars_used = 0
            for doc in matching[:max_docs]:
                content = doc.get("content", "").strip()
                if not content:
                    continue
                source = doc.get("source", doc.get("title", "document"))
                sub = doc.get("subCategory") or doc.get("sub_category") or ""
                header = f"[{source}" + (f" | {sub}]" if sub else "]")
                snippet = f"{header}:\n{content}"
                if chars_used + len(snippet) > budget:
                    remaining = budget - chars_used
                    if remaining > 300:
                        truncated = content[: remaining - len(header) - 20]
                        snippet = f"{header}:\n{truncated}..."
                        doc_lines.append(snippet)
                    break
                doc_lines.append(snippet)
                chars_used += len(snippet)

            if doc_lines:
                sections.append(f"## {label}:\n" + "\n\n".join(doc_lines))

    # ── 3. Application portfolio ──────────────────────────────────────────────
    app_portfolio = input_data.get("applicationPortfolio", [])
    if app_portfolio:
        app_budget = int(max_chars * 0.08)
        app_lines: list[str] = []
        chars_used = 0
        for app in app_portfolio:
            name = app.get("name", "")
            tech_raw = app.get("technologyStack", app.get("technology", app.get("techStack", [])))
            tech = ", ".join(tech_raw) if isinstance(tech_raw, list) else str(tech_raw or "")
            status = app.get("status", app.get("lifecycleStatus", ""))
            segment = app.get("businessSegment", "")
            criticality = app.get("businessCriticality", "")
            line = f"- {name}"
            if tech:
                line += f" | Tech: {tech}"
            if status:
                line += f" | Status: {status}"
            if segment:
                line += f" | Segment: {segment}"
            if criticality:
                line += f" | Criticality: {criticality}"
            if chars_used + len(line) > app_budget:
                break
            app_lines.append(line)
            chars_used += len(line)
        if app_lines:
            sections.append("## APPLICATION PORTFOLIO:\n" + "\n".join(app_lines))

    if not sections:
        return ""

    return "\n\n" + "\n\n".join(sections) + "\n"
