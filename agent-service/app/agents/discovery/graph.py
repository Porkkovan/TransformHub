"""Discovery agent — enhanced with multi-source enrichment, multi-pass mode,
confidence scoring, and source attribution.

Multi-pass mode
───────────────
pass_number=0 (default / full):
    fetch_enrichment → parse_codebase → extract_functionalities → generate_brd
    → cluster_bmad → map_personas → persist_results
    Inserts: products + capabilities + functionalities in one shot.

pass_number=1 (L1 only):
    Same pipeline but persist_results inserts only digital_products.
    Returns {repository_id, products: [{id, name}]} for human review.

pass_number=2 (L2 — add capabilities):
    Fetches confirmed products from DB (by repository_id).
    Runs enrichment + functionality extraction.
    cluster_bmad uses confirmed products as hard constraints.
    persist_results inserts only digital_capabilities.

pass_number=3 (L3 — add functionalities):
    Fetches confirmed products + capabilities from DB.
    Assigns functionalities under confirmed capabilities.
    persist_results inserts only functionalities.

Enrichment sources
──────────────────
• openapi_urls: list[str]   — Swagger/OpenAPI spec URLs per repo
• github_token: str         — Optional GitHub PAT for private repos
• db_schema_text: str       — Pasted SQL/JSON schema
• domain_context: str       — Questionnaire: free-text domain description
• known_products: str       — Questionnaire: comma-sep known product names
• known_capabilities: str   — Questionnaire: comma-sep known capability names

Confidence scoring
──────────────────
Each item receives a confidence 0.0–1.0 and a sources list.
Base:     0.35  (URL / HTML analysis only)
+0.20     openapi_spec
+0.15     github_structure (folder/module names)
+0.15     github_tests     (test file names describe behaviour)
+0.20     db_schema        (entity-level evidence)
+0.15     context_document (uploaded BRDs / arch docs)
+0.15     integration_data (Jira / Confluence / etc.)
+0.10     questionnaire    (human-provided hints)
Triangulation bonus +0.10 when ≥3 independent sources agree.
Cap: 1.0
"""

import json
import logging
import re
import uuid
from typing import Any

import httpx
from langgraph.graph import StateGraph

from app.agents.base import AgentState, BaseAgent
from app.core.database import db_pool
from app.agents.org_context import (
    get_org_context,
    format_context_section,
    format_personas,
    org_description,
)
from app.services.claude_client import claude_client

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Source weights for confidence scoring
# ---------------------------------------------------------------------------
SOURCE_WEIGHTS: dict[str, float] = {
    "url_analysis":       0.35,
    "openapi_spec":       0.20,
    "github_structure":   0.15,
    "github_tests":       0.15,
    "db_schema":          0.20,
    "context_document":   0.15,
    "integration_data":   0.15,
    "questionnaire":      0.10,
}
TRIANGULATION_BONUS = 0.10
TRIANGULATION_THRESHOLD = 3


def compute_confidence(sources: list[str]) -> float:
    """Compute confidence score from a list of source names."""
    score = sum(SOURCE_WEIGHTS.get(s, 0.0) for s in sources)
    if len(set(sources)) >= TRIANGULATION_THRESHOLD:
        score += TRIANGULATION_BONUS
    return round(min(1.0, score), 3)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_github_owner_repo(url: str) -> tuple[str, str] | None:
    """Extract (owner, repo) from a GitHub URL."""
    m = re.match(r"https?://github\.com/([^/]+)/([^/?.#]+)", url)
    if m:
        return m.group(1), m.group(2).removesuffix(".git")
    return None


async def _fetch_json(url: str, headers: dict | None = None, timeout: int = 15) -> Any:
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
            r = await client.get(url, headers=headers or {})
            r.raise_for_status()
            return r.json()
    except Exception as exc:
        logger.debug("_fetch_json %s failed: %s", url, exc)
        return None


async def _fetch_text(url: str, headers: dict | None = None, timeout: int = 15) -> str:
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
            r = await client.get(url, headers=headers or {})
            r.raise_for_status()
            return r.text[:8000]  # cap at 8k chars
    except Exception as exc:
        logger.debug("_fetch_text %s failed: %s", url, exc)
        return ""


# ---------------------------------------------------------------------------
# Node 0: fetch_enrichment_sources (NEW)
# ---------------------------------------------------------------------------

async def fetch_enrichment_sources(state: AgentState) -> dict[str, Any]:
    """Fetch OpenAPI specs, GitHub repo structure, and process DB schema."""
    input_data = state["input_data"]
    repos_list: list[dict] = input_data.get("repositories", [])
    openapi_urls: list[str] = input_data.get("openapi_urls", [])
    github_token: str = input_data.get("github_token", "")
    db_schema_text: str = input_data.get("db_schema_text", "")
    domain_context: str = input_data.get("domain_context", "")
    known_products: str = input_data.get("known_products", "")
    known_capabilities: str = input_data.get("known_capabilities", "")

    enrichment: dict[str, Any] = {
        "openapi_endpoints": [],
        "github_modules": [],
        "github_test_hints": [],
        "db_entities": [],
        "active_sources": ["url_analysis"],  # always have URL analysis
    }

    # ── 1. OpenAPI / Swagger spec fetching ──────────────────────────────────
    if not openapi_urls:
        # Auto-discover from repo URLs: try common spec paths
        for repo in repos_list:
            base = repo.get("repositoryUrl", "").rstrip("/")
            if not base or "github.com" in base:
                continue  # skip GitHub repo URLs for auto-discover
            for path in ["/openapi.json", "/swagger.json", "/api-docs", "/v3/api-docs", "/openapi.yaml"]:
                openapi_urls.append(base + path)

    parsed_specs: list[dict] = []
    for spec_url in openapi_urls[:5]:  # limit to 5 spec URLs
        data = await _fetch_json(spec_url)
        if data and isinstance(data, dict) and ("paths" in data or "openapi" in data or "swagger" in data):
            parsed_specs.append(data)
            break  # use first valid spec found

    for spec in parsed_specs:
        paths = spec.get("paths", {})
        for path, methods in paths.items():
            for method, operation in methods.items():
                if not isinstance(operation, dict):
                    continue
                op_id = operation.get("operationId", "")
                summary = operation.get("summary", "")
                tags = operation.get("tags", [])
                desc = operation.get("description", "")
                enrichment["openapi_endpoints"].append({
                    "path": path,
                    "method": method.upper(),
                    "operationId": op_id,
                    "summary": summary or op_id,
                    "tags": tags,
                    "description": desc[:200],
                })
        if enrichment["openapi_endpoints"]:
            enrichment["active_sources"].append("openapi_spec")
            logger.info("Fetched %d OpenAPI endpoints", len(enrichment["openapi_endpoints"]))

    # ── 2. GitHub repository structure ──────────────────────────────────────
    gh_headers = {}
    if github_token:
        gh_headers["Authorization"] = f"Bearer {github_token}"
    gh_headers["Accept"] = "application/vnd.github+json"
    gh_headers["X-GitHub-Api-Version"] = "2022-11-28"

    for repo in repos_list[:3]:  # limit to 3 repos
        url = repo.get("repositoryUrl", "")
        pair = _extract_github_owner_repo(url)
        if not pair:
            continue
        owner, repo_name = pair

        # Fetch repo tree
        tree_data = await _fetch_json(
            f"https://api.github.com/repos/{owner}/{repo_name}/git/trees/HEAD?recursive=1",
            headers=gh_headers,
        )
        if tree_data and isinstance(tree_data, dict):
            tree_items: list[dict] = tree_data.get("tree", [])

            # Extract folder/module structure (dirs at depth 1-3)
            dirs_seen: set[str] = set()
            test_hints: list[str] = []
            for item in tree_items[:2000]:  # cap at 2000 items
                path: str = item.get("path", "")
                parts = path.split("/")

                # Collect meaningful dirs (src/, services/, modules/, domains/, etc.)
                if item.get("type") == "tree" and len(parts) <= 3:
                    dir_name = parts[-1].lower()
                    meaningful_dirs = {
                        "services", "service", "modules", "module", "domains", "domain",
                        "features", "feature", "components", "api", "controllers",
                        "handlers", "usecases", "usecase", "use_cases", "repositories",
                        "entities", "models", "core", "business", "application",
                    }
                    if dir_name in meaningful_dirs or len(parts) == 2:
                        if path not in dirs_seen:
                            dirs_seen.add(path)
                            enrichment["github_modules"].append(path)

                # Collect test file hints
                name_lower = path.lower()
                is_test = (
                    "test" in name_lower or "spec" in name_lower
                    or "/__tests__/" in path or "/spec/" in path
                )
                if is_test and item.get("type") == "blob" and path.endswith(
                    (".py", ".ts", ".js", ".java", ".cs", ".go", ".rb")
                ):
                    # Extract readable function/test names from path
                    basename = parts[-1]
                    readable = re.sub(r"\.(test|spec)\.(ts|js|py|java|cs|go|rb)$", "", basename)
                    readable = re.sub(r"_test\.(py|java|go|rb)$", "", readable)
                    readable = readable.replace("_", " ").replace("-", " ")
                    if len(readable) > 3:
                        test_hints.append(readable)

            enrichment["github_test_hints"] = test_hints[:100]
            if enrichment["github_modules"] or test_hints:
                enrichment["active_sources"].append("github_structure")
            if test_hints:
                enrichment["active_sources"].append("github_tests")

        # Fetch README
        readme_text = await _fetch_text(
            f"https://api.github.com/repos/{owner}/{repo_name}/readme",
            headers={**gh_headers, "Accept": "application/vnd.github.raw+json"},
        )
        if readme_text:
            enrichment["readme_text"] = readme_text[:3000]

        logger.info(
            "GitHub enrichment for %s/%s: %d modules, %d test hints",
            owner, repo_name, len(enrichment["github_modules"]), len(enrichment["github_test_hints"]),
        )

    # ── 3. Database schema parsing ───────────────────────────────────────────
    if db_schema_text.strip():
        # Extract table/entity names from SQL CREATE TABLE or JSON schema
        table_names = re.findall(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`\"']?(\w+)[`\"']?", db_schema_text, re.IGNORECASE)
        # Also try JSON schema: "definitions" keys or top-level keys
        if not table_names:
            try:
                schema_json = json.loads(db_schema_text)
                defs = schema_json.get("definitions", schema_json.get("$defs", schema_json))
                if isinstance(defs, dict):
                    table_names = list(defs.keys())[:50]
            except (json.JSONDecodeError, Exception):
                pass
        enrichment["db_entities"] = table_names[:50]
        if table_names:
            enrichment["active_sources"].append("db_schema")
            logger.info("DB schema: found %d entities", len(table_names))

    # ── 4. Detect integration data in context docs ───────────────────────────
    context_docs = input_data.get("contextDocuments", [])
    has_integration = any(d.get("category") == "integration" for d in context_docs)
    has_context_docs = any(d.get("category") != "integration" for d in context_docs)
    if has_integration:
        enrichment["active_sources"].append("integration_data")
    if has_context_docs:
        enrichment["active_sources"].append("context_document")

    # ── 5. Questionnaire data ────────────────────────────────────────────────
    if domain_context.strip() or known_products.strip() or known_capabilities.strip():
        enrichment["active_sources"].append("questionnaire")
        enrichment["questionnaire"] = {
            "domain_context": domain_context,
            "known_products": [p.strip() for p in known_products.split(",") if p.strip()],
            "known_capabilities": [c.strip() for c in known_capabilities.split(",") if c.strip()],
        }

    logger.info("Enrichment complete. Active sources: %s", enrichment["active_sources"])
    return {"input_data": {**input_data, "enrichment": enrichment}}


# ---------------------------------------------------------------------------
# Node 1: parse_codebase (enhanced to use enrichment)
# ---------------------------------------------------------------------------

async def parse_codebase(state: AgentState) -> dict[str, Any]:
    """Analyze codebase structure — enhanced with enrichment data."""
    input_data = state["input_data"]
    org = get_org_context(input_data)
    ctx = format_context_section(input_data)
    repos_list = input_data.get("repositories", [])
    enrichment: dict = input_data.get("enrichment", {})

    repo_name = (
        input_data.get("repository_name")
        or (repos_list[0].get("repositoryName") if repos_list else None)
        or "unknown-repo"
    )
    repo_url = (
        input_data.get("repository_url", "")
        or (repos_list[0].get("repositoryUrl", "") if repos_list else "")
    )

    # Build enrichment context for the prompt
    enrichment_ctx = ""
    if enrichment.get("github_modules"):
        module_list = "\n".join(f"  - {m}" for m in enrichment["github_modules"][:40])
        enrichment_ctx += f"\n\nGitHub Repository Structure (folder/module paths):\n{module_list}"
    if enrichment.get("readme_text"):
        enrichment_ctx += f"\n\nREADME content:\n{enrichment['readme_text'][:1500]}"
    if enrichment.get("db_entities"):
        enrichment_ctx += f"\n\nDatabase entities: {', '.join(enrichment['db_entities'][:30])}"
    if enrichment.get("questionnaire"):
        q = enrichment["questionnaire"]
        if q.get("domain_context"):
            enrichment_ctx += f"\n\nDomain context (provided by user): {q['domain_context']}"
    if enrichment.get("openapi_endpoints"):
        tags = list({t for ep in enrichment["openapi_endpoints"] for t in ep.get("tags", [])})
        enrichment_ctx += f"\n\nOpenAPI endpoint groups (tags): {', '.join(tags[:20])}"
        enrichment_ctx += f"\n({len(enrichment['openapi_endpoints'])} total endpoints discovered)"

    prompt = (
        f"Analyze the following application for {org_description(org)}.\n"
        f"Repository: {repo_name}\nURL: {repo_url}\n"
        f"{enrichment_ctx}\n{ctx}"
        f"\nIdentify the major modules, services, and technical structure. "
        f"Return JSON: {{\"modules\": [{{name, description, files}}], "
        f"\"services\": [{{name, purpose, dependencies}}], "
        f"\"technology_stack\": [string]}}"
    )

    try:
        raw = await claude_client.analyze_structured(prompt)
        parsed = json.loads(raw)
    except Exception as exc:
        logger.error("parse_codebase failed: %s", exc)
        parsed = {"modules": [], "services": [], "technology_stack": []}

    return {
        "input_data": {**input_data, "parsed_codebase": parsed},
        "repository_id": input_data.get("repository_id"),
    }


# ---------------------------------------------------------------------------
# Node 2: extract_functionalities (enriched with OpenAPI + test hints)
# ---------------------------------------------------------------------------

async def extract_functionalities(state: AgentState) -> dict[str, Any]:
    """Identify business functionalities — seeded from OpenAPI endpoints + test file names."""
    input_data = state["input_data"]
    org = get_org_context(input_data)
    ctx = format_context_section(input_data)
    parsed = input_data.get("parsed_codebase", {})
    enrichment: dict = input_data.get("enrichment", {})
    active_sources: list[str] = enrichment.get("active_sources", ["url_analysis"])

    # Build seed context from enrichment
    seed_ctx = ""
    if enrichment.get("openapi_endpoints"):
        endpoints = enrichment["openapi_endpoints"][:80]
        ep_lines = [
            f"  {ep['method']} {ep['path']}: {ep['summary']}"
            for ep in endpoints
        ]
        seed_ctx += f"\n\nOpenAPI Endpoints (use these as seed functionalities):\n" + "\n".join(ep_lines)

    if enrichment.get("github_test_hints"):
        hints = enrichment["github_test_hints"][:40]
        seed_ctx += f"\n\nTest file names (strong hints for actual functionalities):\n" + "\n".join(f"  - {h}" for h in hints)

    if enrichment.get("db_entities"):
        seed_ctx += f"\n\nDB entities (infer CRUD functionalities): {', '.join(enrichment['db_entities'][:20])}"

    if enrichment.get("questionnaire", {}).get("domain_context"):
        seed_ctx += f"\n\nDomain context: {enrichment['questionnaire']['domain_context']}"

    prompt = (
        f"Identify all discrete business functionalities for {org_description(org)}.\n"
        f"Codebase structure:\n{json.dumps(parsed, indent=2)}\n"
        f"{seed_ctx}\n{ctx}\n\n"
        f"For each functionality, assign a confidence score (0.0-1.0) based on how well evidenced it is.\n"
        f"Also list which evidence sources support it: url_analysis, openapi_spec, github_structure, "
        f"github_tests, db_schema, context_document, integration_data, questionnaire.\n"
        f"Return a JSON array: "
        f"[{{name, description, sourceFiles, confidence (0.0-1.0), sources: [source_name]}}]"
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=8192)
        functionalities = json.loads(raw)
        if not isinstance(functionalities, list):
            functionalities = functionalities.get("functionalities", [])
        # Ensure sources are only valid ones and recalculate with our formula
        valid_src = set(SOURCE_WEIGHTS.keys())
        for f in functionalities:
            f_sources = [s for s in f.get("sources", []) if s in valid_src]
            # Always include base source
            if "url_analysis" not in f_sources:
                f_sources.insert(0, "url_analysis")
            # Add enrichment sources that are globally active
            for src in ["openapi_spec", "github_tests", "db_schema"]:
                if src in active_sources and src not in f_sources:
                    # Only add if this functionality plausibly comes from that source
                    pass  # LLM decides per item
            f["sources"] = list(dict.fromkeys(f_sources))  # dedup preserve order
            f["confidence"] = compute_confidence(f["sources"])
    except Exception as exc:
        logger.error("extract_functionalities failed: %s", exc)
        functionalities = []

    return {"functionalities": functionalities}


# ---------------------------------------------------------------------------
# Node 3: generate_brd (unchanged except uses enrichment for domain context)
# ---------------------------------------------------------------------------

async def generate_brd(state: AgentState) -> dict[str, Any]:
    """Generate a Business Requirements Document."""
    org = get_org_context(state["input_data"])
    functionalities = state.get("functionalities", [])
    enrichment: dict = state["input_data"].get("enrichment", {})
    domain_ctx = enrichment.get("questionnaire", {}).get("domain_context", "")

    domain_line = f"\nDomain context: {domain_ctx}" if domain_ctx else ""
    prompt = (
        f"Generate a comprehensive BRD for {org_description(org)}.{domain_line}\n"
        f"Discovered functionalities:\n{json.dumps(functionalities, indent=2)}\n\n"
        f"Include: Executive Summary, Business Objectives, Functional Requirements "
        f"(one per functionality), Non-Functional Requirements, Assumptions and Constraints.\n"
        f"Write in professional markdown."
    )
    try:
        brd = await claude_client.analyze(prompt, max_tokens=8192)
    except Exception as exc:
        logger.error("generate_brd failed: %s", exc)
        brd = "Error generating BRD."
    return {"brd": brd}


# ---------------------------------------------------------------------------
# Node 4: cluster_bmad (multi-pass aware + confidence-scored)
# ---------------------------------------------------------------------------

async def cluster_bmad(state: AgentState) -> dict[str, Any]:
    """Cluster into BMAD hierarchy — multi-pass aware, questionnaire-informed."""
    input_data = state["input_data"]
    org = get_org_context(input_data)
    functionalities = state.get("functionalities", [])
    enrichment: dict = input_data.get("enrichment", {})
    pass_number: int = input_data.get("pass_number", 0)

    questionnaire = enrichment.get("questionnaire", {})
    known_products = questionnaire.get("known_products", [])
    known_capabilities = questionnaire.get("known_capabilities", [])

    # Multi-pass: fetch confirmed items from DB
    confirmed_products: list[dict] = []
    confirmed_capabilities: list[dict] = []
    repository_id = input_data.get("repository_id") or state.get("repository_id")

    if pass_number in (2, 3) and repository_id:
        try:
            rows = await db_pool.fetch(
                "SELECT id, name, description FROM digital_products WHERE repository_id = $1 ORDER BY name",
                repository_id,
            )
            confirmed_products = [dict(r) for r in rows]
        except Exception as exc:
            logger.error("Failed to fetch confirmed products: %s", exc)

    if pass_number == 3 and confirmed_products:
        try:
            prod_ids = [p["id"] for p in confirmed_products]
            rows = await db_pool.fetch(
                "SELECT id, name, description, digital_product_id FROM digital_capabilities "
                "WHERE digital_product_id = ANY($1::uuid[]) ORDER BY name",
                prod_ids,
            )
            confirmed_capabilities = [dict(r) for r in rows]
        except Exception as exc:
            logger.error("Failed to fetch confirmed capabilities: %s", exc)

    # Build constraint section
    constraint_ctx = ""
    if known_products:
        constraint_ctx += f"\nKnown products (MUST use these as L1 products if applicable): {', '.join(known_products)}"
    if known_capabilities:
        constraint_ctx += f"\nKnown capabilities (MUST use if applicable): {', '.join(known_capabilities)}"
    if confirmed_products:
        prod_list = ", ".join(p["name"] for p in confirmed_products)
        constraint_ctx += f"\n\nCONFIRMED L1 Products (human-approved — assign capabilities to these ONLY): {prod_list}"
    if confirmed_capabilities:
        cap_list = ", ".join(c["name"] for c in confirmed_capabilities)
        constraint_ctx += f"\nCONFIRMED L2 Capabilities (human-approved — assign functionalities to these ONLY): {cap_list}"

    # Adjust prompt depth based on pass_number
    if pass_number == 1:
        depth_instruction = (
            "Identify only the L1 Digital Products. Do NOT define capabilities or functionalities yet.\n"
            "For each product, assign a confidence score and sources list.\n"
        )
        return_format = (
            '{"capabilities": [], "products": [{'
            '"id": string, "name": string, "description": string, '
            '"confidence": float (0.0-1.0), "sources": [source_names], '
            '"groups": []}]}'
        )
    elif pass_number == 2:
        depth_instruction = (
            "Define L2 Digital Capabilities for the confirmed L1 products. "
            "Assign each capability to exactly one confirmed product. "
            "Do NOT create new products. Do NOT define functionalities yet.\n"
            "For each capability, assign a confidence score and sources list.\n"
        )
        return_format = (
            '{"capabilities": [{'
            '"id": string, "name": string, "description": string, '
            '"capabilityId": matching_confirmed_product_id_or_name, '
            '"confidence": float, "sources": [source_names], '
            '"functionalityNames": []}], "products": []}'
        )
    elif pass_number == 3:
        depth_instruction = (
            "Assign L3 functionalities to confirmed L2 capabilities. "
            "Use ONLY the confirmed capabilities as parents. "
            "Do NOT create new products or capabilities.\n"
            "For each capability, list which functionalities belong to it.\n"
        )
        return_format = (
            '{"capabilities": [{'
            '"id": existing_capability_name, "name": string, '
            '"confidence": float, "sources": [source_names], '
            '"functionalityNames": [matching_functionality_names]}], "products": []}'
        )
    else:
        depth_instruction = (
            "Create the full hierarchy: L1 Products → L2 Capabilities → L3 Functionalities.\n"
            "Include Product Groups and Value Stream Steps.\n"
            "For each item, assign confidence (0.0-1.0) and sources list.\n"
        )
        return_format = (
            '{"capabilities": [{'
            '"id": string, "name": string, "description": string, '
            '"confidence": float, "sources": [source_names], '
            '"functionalityNames": []}], '
            '"products": [{'
            '"id": string, "name": string, "description": string, '
            '"capabilityId": string, "confidence": float, "sources": [source_names], '
            '"groups": [{"id": string, "name": string, "steps": [{"id": string, "name": string, "description": string, "order": int}]}]}]}'
        )

    prompt = (
        f"Cluster into the BMAD product hierarchy for {org_description(org)}.\n"
        f"{depth_instruction}{constraint_ctx}\n\n"
        f"Business functionalities to cluster:\n{json.dumps(functionalities, indent=2)}\n\n"
        f"Return JSON in this exact format:\n{return_format}"
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=8192)
        bmad = json.loads(raw)
    except Exception as exc:
        logger.error("cluster_bmad failed: %s", exc)
        bmad = {"capabilities": [], "products": []}

    # Recalculate confidence with our formula
    valid_src = set(SOURCE_WEIGHTS.keys())
    for item in bmad.get("capabilities", []) + bmad.get("products", []):
        item_sources = [s for s in item.get("sources", []) if s in valid_src]
        if not item_sources:
            item_sources = ["url_analysis"]
        item["sources"] = item_sources
        item["confidence"] = compute_confidence(item_sources)

    return {
        "capabilities": bmad.get("capabilities", []),
        "products": bmad.get("products", []),
        "confirmed_products_db": confirmed_products,
        "confirmed_capabilities_db": confirmed_capabilities,
    }


# ---------------------------------------------------------------------------
# Node 5: map_personas (unchanged)
# ---------------------------------------------------------------------------

async def map_personas(state: AgentState) -> dict[str, Any]:
    """Map functionalities to personas."""
    org = get_org_context(state["input_data"])
    functionalities = state.get("functionalities", [])
    capabilities = state.get("capabilities", [])

    prompt = (
        f"Map functionalities and capabilities to personas for {org_description(org)}.\n"
        f"Functionalities:\n{json.dumps(functionalities, indent=2)}\n\n"
        f"Capabilities:\n{json.dumps(capabilities, indent=2)}\n\n"
        f"Persona types:\n{format_personas(org['personas'])}\n\n"
        f"Return JSON array: [{{persona_type, persona_name, functionality_name, "
        f"capability_name, relevance_score (0.0-1.0)}}]"
    )

    try:
        raw = await claude_client.analyze_structured(prompt)
        personas = json.loads(raw)
        if not isinstance(personas, list):
            personas = personas.get("personas", [])
    except Exception as exc:
        logger.error("map_personas failed: %s", exc)
        personas = []

    return {"personas": personas}


# ---------------------------------------------------------------------------
# Node 6: persist_results (multi-pass, saves confidence + sources)
# ---------------------------------------------------------------------------

async def persist_results(state: AgentState) -> dict[str, Any]:
    """Write to PostgreSQL — multi-pass aware, saves confidence + sources."""
    input_data = state["input_data"]
    repository_id = state.get("repository_id") or input_data.get("repository_id") or str(uuid.uuid4())
    pass_number: int = input_data.get("pass_number", 0)

    functionalities_raw = state.get("functionalities", [])
    capabilities = state.get("capabilities", [])
    products = state.get("products", [])
    personas = state.get("personas", [])
    brd = state.get("brd", "")
    confirmed_products_db: list[dict] = state.get("confirmed_products_db", [])
    confirmed_capabilities_db: list[dict] = state.get("confirmed_capabilities_db", [])

    org_data = input_data.get("organization", {})
    organization_id = org_data.get("id")
    explicit_segment = input_data.get("businessSegment") or input_data.get("business_segment")
    org_segments = org_data.get("businessSegments", org_data.get("business_segments", []))
    default_segment = explicit_segment or (org_segments[0] if org_segments else None)

    func_raw_map: dict[str, dict] = {f["name"]: f for f in functionalities_raw}

    product_id_map: dict[str, str] = {}
    cap_id_map: dict[str, str] = {}
    func_id_map: dict[str, str] = {}

    try:
        # ── Upsert repository ────────────────────────────────────────────────
        _repos_list = input_data.get("repositories", [])
        _repo_name = (
            input_data.get("repository_name")
            or (_repos_list[0].get("repositoryName") if _repos_list else None)
            or "unknown"
        )
        _repo_url = (
            input_data.get("repository_url")
            or (_repos_list[0].get("repositoryUrl", "") if _repos_list else "")
        )
        await db_pool.execute(
            """
            INSERT INTO repositories (id, name, url, description, organization_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
              name = CASE WHEN repositories.name IN ('', 'unknown') THEN EXCLUDED.name ELSE repositories.name END,
              description = EXCLUDED.description,
              organization_id = EXCLUDED.organization_id,
              updated_at = NOW()
            """,
            repository_id, _repo_name, _repo_url,
            (brd[:500] + "...") if len(brd) > 500 else brd,
            organization_id,
        )

        # ── PASS 1 or FULL: insert digital_products ──────────────────────────
        if pass_number in (0, 1):
            for product in products:
                product_db_id = str(uuid.uuid4())
                bmad_key = product.get("id", product["name"])
                product_id_map[bmad_key] = product_db_id
                confidence = product.get("confidence") or compute_confidence(product.get("sources", ["url_analysis"]))
                sources = product.get("sources", ["url_analysis"])

                await db_pool.execute(
                    """
                    INSERT INTO digital_products (id, repository_id, name, description,
                        business_segment, confidence, sources, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7::text[], NOW(), NOW())
                    """,
                    product_db_id, repository_id, product["name"],
                    product.get("description", ""), default_segment, confidence, sources,
                )

                # Product groups + value stream steps
                for group in product.get("groups", []):
                    group_db_id = str(uuid.uuid4())
                    await db_pool.execute(
                        "INSERT INTO product_groups (id, digital_product_id, name, created_at, updated_at) "
                        "VALUES ($1, $2, $3, NOW(), NOW())",
                        group_db_id, product_db_id, group["name"],
                    )
                    for step in group.get("steps", []):
                        await db_pool.execute(
                            """INSERT INTO value_stream_steps (id, product_group_id, name, description,
                               step_order, step_type, created_at, updated_at)
                               VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())""",
                            str(uuid.uuid4()), group_db_id, step["name"],
                            step.get("description", ""), step.get("order", 0), step.get("type", "process"),
                        )

            # Fallback product if nothing generated
            if not product_id_map and functionalities_raw:
                default_product_id = str(uuid.uuid4())
                default_name = (
                    input_data.get("repository_name")
                    or (_repos_list[0].get("repositoryName") if _repos_list else None)
                    or "Discovered Product"
                )
                product_id_map["_default"] = default_product_id
                await db_pool.execute(
                    """INSERT INTO digital_products (id, repository_id, name, description,
                       business_segment, confidence, sources, created_at, updated_at)
                       VALUES ($1, $2, $3, $4, $5, $6, $7::text[], NOW(), NOW())""",
                    default_product_id, repository_id, default_name,
                    "Auto-generated product from discovery", default_segment,
                    0.35, ["url_analysis"],
                )

        # ── For pass 2/3: use confirmed DB products as our product_id_map ────
        if pass_number in (2, 3):
            for p in confirmed_products_db:
                product_id_map[p["name"]] = p["id"]
                product_id_map[p["id"]] = p["id"]

        # ── PASS 2 or FULL: insert digital_capabilities ──────────────────────
        if pass_number in (0, 2):
            # Build cap → product reverse map
            cap_to_product_keys: dict[str, list[str]] = {}
            for product in products:
                cap_ref = product.get("capabilityId", "")
                if cap_ref:
                    cap_to_product_keys.setdefault(cap_ref, []).append(
                        product.get("id", product["name"])
                    )
            # For pass 2: capabilities are in state["capabilities"] and reference confirmed products
            for cap in capabilities:
                cap_key = cap.get("id", cap["name"])

                # Resolve parent product DB id
                product_db_id = None
                # Direct match by name from confirmed products
                cap_ref = cap.get("capabilityId", "")
                if cap_ref in product_id_map:
                    product_db_id = product_id_map[cap_ref]
                else:
                    # Try name match in confirmed
                    for pname, pid in product_id_map.items():
                        if cap_ref and (cap_ref.lower() in pname.lower() or pname.lower() in cap_ref.lower()):
                            product_db_id = pid
                            break
                if not product_db_id:
                    for pk in cap_to_product_keys.get(cap_key, []):
                        if pk in product_id_map:
                            product_db_id = product_id_map[pk]
                            break
                if not product_db_id:
                    product_db_id = next(iter(product_id_map.values()), None)
                if not product_db_id:
                    continue

                cap_db_id = str(uuid.uuid4())
                cap_id_map[cap_key] = cap_db_id
                cap_id_map[cap["name"]] = cap_db_id
                confidence = cap.get("confidence") or compute_confidence(cap.get("sources", ["url_analysis"]))
                sources = cap.get("sources", ["url_analysis"])

                await db_pool.execute(
                    """INSERT INTO digital_capabilities (id, digital_product_id, name, description,
                       category, confidence, sources, created_at, updated_at)
                       VALUES ($1, $2, $3, $4, $5, $6, $7::text[], NOW(), NOW())""",
                    cap_db_id, product_db_id, cap["name"], cap.get("description", ""),
                    cap.get("category", ""), confidence, sources,
                )

                # For full pass: insert functionalities now
                if pass_number == 0:
                    for func_name in cap.get("functionalityNames", []):
                        raw = func_raw_map.get(func_name, {"name": func_name, "description": "", "sourceFiles": []})
                        func_db_id = str(uuid.uuid4())
                        func_id_map[func_name] = func_db_id
                        func_confidence = raw.get("confidence") or compute_confidence(raw.get("sources", ["url_analysis"]))
                        func_sources = raw.get("sources", ["url_analysis"])
                        await db_pool.execute(
                            """INSERT INTO functionalities (id, digital_capability_id, name, description,
                               source_files, confidence, sources, created_at, updated_at)
                               VALUES ($1, $2, $3, $4, $5::text[], $6, $7::text[], NOW(), NOW())""",
                            func_db_id, cap_db_id, raw["name"], raw.get("description", ""),
                            raw.get("sourceFiles", []), func_confidence, func_sources,
                        )

            # Fallback capability if nothing generated
            if not cap_id_map and functionalities_raw and pass_number == 0:
                default_product_db_id = next(iter(product_id_map.values()), None)
                if default_product_db_id:
                    default_cap_id = str(uuid.uuid4())
                    await db_pool.execute(
                        """INSERT INTO digital_capabilities (id, digital_product_id, name, description,
                           category, confidence, sources, created_at, updated_at)
                           VALUES ($1, $2, $3, $4, $5, $6, $7::text[], NOW(), NOW())""",
                        default_cap_id, default_product_db_id, "Core Capabilities",
                        "Auto-grouped from discovery", "", 0.35, ["url_analysis"],
                    )
                    for func in functionalities_raw:
                        func_db_id = str(uuid.uuid4())
                        func_id_map[func["name"]] = func_db_id
                        await db_pool.execute(
                            """INSERT INTO functionalities (id, digital_capability_id, name, description,
                               source_files, confidence, sources, created_at, updated_at)
                               VALUES ($1, $2, $3, $4, $5::text[], $6, $7::text[], NOW(), NOW())""",
                            func_db_id, default_cap_id, func["name"], func.get("description", ""),
                            func.get("sourceFiles", []),
                            func.get("confidence", 0.35), func.get("sources", ["url_analysis"]),
                        )

        # ── For pass 3: build cap_id_map from confirmed DB capabilities ───────
        if pass_number == 3:
            for c in confirmed_capabilities_db:
                cap_id_map[c["name"]] = c["id"]
                cap_id_map[c["id"]] = c["id"]

        # ── PASS 3: insert functionalities only ───────────────────────────────
        if pass_number == 3:
            for cap in capabilities:
                cap_key = cap.get("id", cap["name"])
                cap_db_id = cap_id_map.get(cap_key) or cap_id_map.get(cap.get("name", ""))
                if not cap_db_id:
                    # Fuzzy match
                    for cname, cid in cap_id_map.items():
                        if cap_key and (cap_key.lower() in cname.lower() or cname.lower() in cap_key.lower()):
                            cap_db_id = cid
                            break
                if not cap_db_id:
                    continue
                for func_name in cap.get("functionalityNames", []):
                    raw = func_raw_map.get(func_name, {"name": func_name, "description": "", "sourceFiles": []})
                    func_db_id = str(uuid.uuid4())
                    func_id_map[func_name] = func_db_id
                    func_confidence = raw.get("confidence") or compute_confidence(raw.get("sources", ["url_analysis"]))
                    func_sources = raw.get("sources", ["url_analysis"])
                    await db_pool.execute(
                        """INSERT INTO functionalities (id, digital_capability_id, name, description,
                           source_files, confidence, sources, created_at, updated_at)
                           VALUES ($1, $2, $3, $4, $5::text[], $6, $7::text[], NOW(), NOW())""",
                        func_db_id, cap_db_id, raw["name"], raw.get("description", ""),
                        raw.get("sourceFiles", []), func_confidence, func_sources,
                    )

        # ── Persona mappings (all passes) ────────────────────────────────────
        if pass_number in (0, 3):
            for mapping in personas:
                func_name = mapping.get("functionality_name", "")
                func_db_id = func_id_map.get(func_name)
                if not func_db_id:
                    for name, fid in func_id_map.items():
                        if func_name and (func_name.lower() in name.lower() or name.lower() in func_name.lower()):
                            func_db_id = fid
                            break
                if not func_db_id:
                    continue
                await db_pool.execute(
                    """INSERT INTO persona_mappings (id, functionality_id, persona_type, persona_name,
                       responsibilities, created_at, updated_at)
                       VALUES ($1, $2, $3, $4, $5::text[], NOW(), NOW())""",
                    str(uuid.uuid4()), func_db_id,
                    mapping.get("persona_type", ""), mapping.get("persona_name", ""),
                    mapping.get("responsibilities", [mapping.get("capability_name", "")]),
                )

        logger.info(
            "Discovery pass=%d persisted: %d products, %d caps, %d funcs",
            pass_number, len(product_id_map), len(cap_id_map), len(func_id_map),
        )
    except Exception as exc:
        logger.error("persist_results failed: %s", exc)
        return {"error": str(exc)}

    # Build summary of confirmed items for multi-pass handoff
    products_summary = [
        {"id": v, "name": k} for k, v in product_id_map.items() if k != "_default"
    ] if pass_number == 1 else []

    return {
        "results": {
            "repository_id": repository_id,
            "pass_number": pass_number,
            "products_count": len(product_id_map),
            "capabilities_count": len(cap_id_map),
            "functionalities_count": len(func_id_map),
            "persona_mappings_count": len(personas) if pass_number in (0, 3) else 0,
            "brd_generated": bool(brd),
            # For multi-pass: return what was created so frontend can show it
            "products_created": products_summary,
            "active_sources": state["input_data"].get("enrichment", {}).get("active_sources", ["url_analysis"]),
        }
    }


# ---------------------------------------------------------------------------
# Build the LangGraph StateGraph
# ---------------------------------------------------------------------------

graph = StateGraph(AgentState)

graph.add_node("fetch_enrichment_sources", fetch_enrichment_sources)
graph.add_node("parse_codebase", parse_codebase)
graph.add_node("extract_functionalities", extract_functionalities)
graph.add_node("generate_brd", generate_brd)
graph.add_node("cluster_bmad", cluster_bmad)
graph.add_node("map_personas", map_personas)
graph.add_node("persist_results", persist_results)

graph.set_entry_point("fetch_enrichment_sources")
graph.add_edge("fetch_enrichment_sources", "parse_codebase")
graph.add_edge("parse_codebase", "extract_functionalities")
graph.add_edge("extract_functionalities", "generate_brd")
graph.add_edge("generate_brd", "cluster_bmad")
graph.add_edge("cluster_bmad", "map_personas")
graph.add_edge("map_personas", "persist_results")
graph.set_finish_point("persist_results")

compiled_graph = graph.compile()


# ---------------------------------------------------------------------------
# Agent class
# ---------------------------------------------------------------------------


class DiscoveryAgent(BaseAgent):
    def get_name(self) -> str:
        return "discovery"

    async def run(self, input_data: dict[str, Any]) -> dict[str, Any]:
        logger.info(
            "DiscoveryAgent starting — pass=%d, sources=%s, keys=%s",
            input_data.get("pass_number", 0),
            input_data.get("openapi_urls", []),
            list(input_data.keys()),
        )
        initial_state: AgentState = {"input_data": input_data}
        try:
            final_state = await compiled_graph.ainvoke(initial_state)
        except Exception as exc:
            logger.error("DiscoveryAgent execution failed: %s", exc)
            return {"error": str(exc)}
        return final_state.get("results", {"error": final_state.get("error", "Unknown error")})
