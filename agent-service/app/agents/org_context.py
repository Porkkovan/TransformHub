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


def format_context_section(input_data: dict[str, Any], max_chars: int = 4000) -> str:
    """Format uploaded context documents and application portfolio for prompt injection.

    Returns an empty string if no context is available, or a formatted block
    that agents can append to their prompts so uploaded documents influence outputs.
    """
    sections: list[str] = []

    # Context documents — top semantic search results from the Context Hub
    context_docs = input_data.get("contextDocuments", [])
    if context_docs:
        # Surface integration docs first so external tool data is prominent
        integration_docs = [d for d in context_docs if d.get("category") == "integration"]
        non_integration_docs = [d for d in context_docs if d.get("category") != "integration"]

        if integration_docs:
            int_lines: list[str] = []
            chars_used_int = 0
            int_budget = int(max_chars * 0.4)
            for doc in integration_docs[:5]:
                metadata = doc.get("metadata") or {}
                content = metadata.get("content", doc.get("content", "")).strip()
                sub_cat = doc.get("subCategory", doc.get("sub_category", ""))
                title = doc.get("title", doc.get("fileName", doc.get("file_name", "External Data")))
                if not content:
                    continue
                snippet = f"### {title} ({sub_cat})\n{content[:1500]}"
                if chars_used_int + len(snippet) > int_budget:
                    break
                int_lines.append(snippet)
                chars_used_int += len(snippet)
            if int_lines:
                sections.append(
                    "## External Integration Data\n"
                    "The following data was imported from connected systems (Jira, Confluence, Azure DevOps, Notion, ServiceNow). "
                    "Use this to inform current-state analysis and prioritise existing initiatives:\n\n"
                    + "\n\n".join(int_lines)
                )

        if non_integration_docs:
            doc_lines: list[str] = []
            chars_used = 0
            doc_budget = int(max_chars * 0.5)
            for doc in non_integration_docs:
                content = doc.get("content", "").strip()
                source = doc.get("source", doc.get("title", "document"))
                if not content:
                    continue
                snippet = f"[{source}]:\n{content}"
                if chars_used + len(snippet) > doc_budget:
                    break
                doc_lines.append(snippet)
                chars_used += len(snippet)
            if doc_lines:
                sections.append(
                    "RELEVANT CONTEXT FROM UPLOADED DOCUMENTS:\n" + "\n\n".join(doc_lines)
                )
        elif not integration_docs:
            pass  # no context docs at all

    # Application portfolio — apps registered in the Context Hub
    app_portfolio = input_data.get("applicationPortfolio", [])
    if app_portfolio:
        app_lines: list[str] = []
        chars_used = 0
        app_budget = int(max_chars * 0.3)
        for app in app_portfolio:
            name = app.get("name", "")
            tech = app.get("technology", app.get("techStack", ""))
            status = app.get("status", app.get("lifecycleStatus", ""))
            segment = app.get("businessSegment", "")
            line = f"- {name}"
            if tech:
                line += f" | Tech: {tech}"
            if status:
                line += f" | Status: {status}"
            if segment:
                line += f" | Segment: {segment}"
            if chars_used + len(line) > app_budget:
                break
            app_lines.append(line)
            chars_used += len(line)
        if app_lines:
            sections.append("APPLICATION PORTFOLIO:\n" + "\n".join(app_lines))

    if not sections:
        return ""

    return "\n\n" + "\n\n".join(sections) + "\n"
