import json
import logging
import uuid
from typing import Any

from langgraph.graph import StateGraph

from app.agents.base import AgentState, BaseAgent
from app.core.database import db_pool
from app.agents.org_context import get_org_context, format_context_section, format_personas, org_description
from app.services.claude_client import claude_client

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Node functions -- each takes AgentState, returns partial state dict update
# ---------------------------------------------------------------------------


async def parse_codebase(state: AgentState) -> dict[str, Any]:
    """Analyze codebase structure and extract file/module information."""
    input_data = state["input_data"]
    org = get_org_context(state["input_data"])
    ctx = format_context_section(state["input_data"])
    repo_url = input_data.get("repository_url", "")
    # Support both direct key and the repositories-array format from the UI
    repos_list = input_data.get("repositories", [])
    repo_name = (
        input_data.get("repository_name")
        or (repos_list[0].get("repositoryName") if repos_list else None)
        or "unknown-repo"
    )
    repo_url = repo_url or (repos_list[0].get("repositoryUrl", "") if repos_list else "")
    codebase_summary = input_data.get("codebase_summary", "")

    prompt = (
        f"Analyze the following codebase information for {org_description(org)}.\n"
        f"Repository: {repo_name}\n"
        f"URL: {repo_url}\n"
        f"Codebase summary:\n{codebase_summary}\n\n"
        f"{ctx}"
        f"Identify the major modules, services, and file structures. "
        f"Return a JSON object with keys: "
        f'"modules" (list of {{name, description, files}}), '
        f'"services" (list of {{name, purpose, dependencies}}), '
        f'"technology_stack" (list of strings).'
    )

    try:
        raw = await claude_client.analyze_structured(prompt)
        parsed = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("parse_codebase failed: %s", exc)
        parsed = {"modules": [], "services": [], "technology_stack": []}

    return {
        "input_data": {**input_data, "parsed_codebase": parsed},
        "repository_id": input_data.get("repository_id"),
    }


async def extract_functionalities(state: AgentState) -> dict[str, Any]:
    """Identify business functionalities from parsed codebase."""
    org = get_org_context(state["input_data"])
    parsed = state["input_data"].get("parsed_codebase", {})

    prompt = (
        f"Given the following parsed codebase structure for {org_description(org)}:\n"
        f"{json.dumps(parsed, indent=2)}\n\n"
        f"Identify all discrete business functionalities. For each functionality provide:\n"
        f"- name: a concise business name\n"
        f"- description: what it does from a business perspective\n"
        f"- sourceFiles: list of files/modules that implement it\n\n"
        f"Return a JSON array of objects with keys: name, description, sourceFiles."
    )

    try:
        raw = await claude_client.analyze_structured(prompt)
        functionalities = json.loads(raw)
        if not isinstance(functionalities, list):
            functionalities = functionalities.get("functionalities", [])
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("extract_functionalities failed: %s", exc)
        functionalities = []

    return {"functionalities": functionalities}


async def generate_brd(state: AgentState) -> dict[str, Any]:
    """Generate a Business Requirements Document from discovered functionalities."""
    org = get_org_context(state["input_data"])
    functionalities = state.get("functionalities", [])

    prompt = (
        f"Generate a comprehensive Business Requirements Document (BRD) for "
        f"{org_description(org)} based on the following discovered functionalities:\n"
        f"{json.dumps(functionalities, indent=2)}\n\n"
        f"The BRD should include:\n"
        f"1. Executive Summary\n"
        f"2. Business Objectives\n"
        f"3. Functional Requirements (one per functionality)\n"
        f"4. Non-Functional Requirements\n"
        f"5. Assumptions and Constraints\n\n"
        f"Write the BRD in professional markdown format."
    )

    try:
        brd = await claude_client.analyze(prompt, max_tokens=8192)
    except Exception as exc:
        logger.error("generate_brd failed: %s", exc)
        brd = "Error generating BRD."

    return {"brd": brd}


async def cluster_bmad(state: AgentState) -> dict[str, Any]:
    """Cluster functionalities into BMAD hierarchy: Capabilities -> Products -> Groups -> Steps."""
    org = get_org_context(state["input_data"])
    functionalities = state.get("functionalities", [])

    prompt = (
        f"Cluster the following business functionalities into the BMAD (Business Model "
        f"Architecture Design) hierarchy for {org_description(org)}:\n"
        f"{json.dumps(functionalities, indent=2)}\n\n"
        f"Create a hierarchy with:\n"
        f"- Digital Capabilities: high-level business capabilities\n"
        f"- Digital Products: products that deliver capabilities\n"
        f"- Product Groups: logical groupings within products\n"
        f"- Value Stream Steps: sequential steps in the value stream\n\n"
        f"Return a JSON object with keys:\n"
        f'"capabilities" (list of {{id, name, description, functionalityNames}}),\n'
        f'"products" (list of {{id, name, description, capabilityId, groups}}),\n'
        f'where each group has {{id, name, steps}} and each step has {{id, name, description, order}}.'
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=8192)
        bmad = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("cluster_bmad failed: %s", exc)
        bmad = {"capabilities": [], "products": []}

    return {
        "capabilities": bmad.get("capabilities", []),
        "products": bmad.get("products", []),
    }


async def map_personas(state: AgentState) -> dict[str, Any]:
    """Map functionalities to personas."""
    org = get_org_context(state["input_data"])
    functionalities = state.get("functionalities", [])
    capabilities = state.get("capabilities", [])

    prompt = (
        f"Map the following business functionalities and capabilities to personas "
        f"for {org_description(org)}:\n\n"
        f"Functionalities:\n{json.dumps(functionalities, indent=2)}\n\n"
        f"Capabilities:\n{json.dumps(capabilities, indent=2)}\n\n"
        f"The persona types are:\n"
        f"{format_personas(org['personas'])}\n\n"
        f"Return a JSON array of objects with keys:\n"
        f"persona_type (FRONT_OFFICE | MIDDLE_OFFICE | BACK_OFFICE), "
        f"persona_name, "
        f"functionality_name, capability_name, relevance_score (0.0-1.0)."
    )

    try:
        raw = await claude_client.analyze_structured(prompt)
        personas = json.loads(raw)
        if not isinstance(personas, list):
            personas = personas.get("personas", [])
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("map_personas failed: %s", exc)
        personas = []

    return {"personas": personas}


async def persist_results(state: AgentState) -> dict[str, Any]:
    """Write all discovered entities to PostgreSQL.

    Actual DB hierarchy:
      repositories
        └── digital_products  (repository_id)
              ├── digital_capabilities  (digital_product_id)
              │     └── functionalities  (digital_capability_id)
              └── product_groups  (digital_product_id)
                    └── value_stream_steps  (product_group_id)
    """
    repository_id = state.get("repository_id") or str(uuid.uuid4())
    functionalities_raw = state.get("functionalities", [])   # from extract_functionalities
    capabilities = state.get("capabilities", [])             # BMAD capabilities
    products = state.get("products", [])                     # BMAD products (with groups + steps)
    personas = state.get("personas", [])
    brd = state.get("brd", "")
    org_data = state["input_data"].get("organization", {})
    organization_id = org_data.get("id")
    # Use the segment explicitly selected in the UI, fall back to org's first segment
    explicit_segment = state["input_data"].get("businessSegment") or state["input_data"].get("business_segment")
    org_segments = org_data.get("businessSegments", org_data.get("business_segments", []))
    default_segment = explicit_segment or (org_segments[0] if org_segments else None)

    # Build raw functionality lookup by name for later linking
    func_raw_map: dict[str, dict] = {f["name"]: f for f in functionalities_raw}

    try:
        # Upsert repository record (with org link)
        _repos_list = state["input_data"].get("repositories", [])
        _repo_name = (
            state["input_data"].get("repository_name")
            or (_repos_list[0].get("repositoryName") if _repos_list else None)
            or "unknown"
        )
        _repo_url = (
            state["input_data"].get("repository_url")
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
            repository_id,
            _repo_name,
            _repo_url,
            (brd[:500] + "...") if len(brd) > 500 else brd,
            organization_id,
        )

        # Step 1: Insert digital_products (one per BMAD product, directly under repository)
        product_id_map: dict[str, str] = {}  # BMAD product key → DB product id
        for product in products:
            product_db_id = str(uuid.uuid4())
            bmad_key = product.get("id", product["name"])
            product_id_map[bmad_key] = product_db_id

            await db_pool.execute(
                """
                INSERT INTO digital_products (id, repository_id, name, description, business_segment, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                """,
                product_db_id,
                repository_id,
                product["name"],
                product.get("description", ""),
                default_segment,
            )

            # Insert product_groups and value_stream_steps nested under this product
            for group in product.get("groups", []):
                group_db_id = str(uuid.uuid4())
                await db_pool.execute(
                    """
                    INSERT INTO product_groups (id, digital_product_id, name, created_at, updated_at)
                    VALUES ($1, $2, $3, NOW(), NOW())
                    """,
                    group_db_id,
                    product_db_id,
                    group["name"],
                )
                for step in group.get("steps", []):
                    await db_pool.execute(
                        """
                        INSERT INTO value_stream_steps (id, product_group_id, name, description,
                                                        step_order, step_type, created_at, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                        """,
                        str(uuid.uuid4()),
                        group_db_id,
                        step["name"],
                        step.get("description", ""),
                        step.get("order", 0),
                        step.get("type", "process"),
                    )

        # Fallback: if no products but we have functionalities, create a default product
        if not product_id_map and functionalities_raw:
            default_product_id = str(uuid.uuid4())
            _fb_repos = state["input_data"].get("repositories", [])
            default_name = (
                state["input_data"].get("repository_name")
                or (_fb_repos[0].get("repositoryName") if _fb_repos else None)
                or "Discovered Product"
            )
            product_id_map["_default"] = default_product_id
            await db_pool.execute(
                """
                INSERT INTO digital_products (id, repository_id, name, description, business_segment, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                """,
                default_product_id,
                repository_id,
                default_name,
                "Auto-generated product from discovery",
                default_segment,
            )

        # Step 2: Insert digital_capabilities under their parent product
        # BMAD: each capability references its parent product via capabilityId on the product
        # Build reverse map: BMAD capability key → list of BMAD product keys that reference it
        cap_to_product_keys: dict[str, list[str]] = {}
        for product in products:
            cap_ref = product.get("capabilityId", "")
            if cap_ref:
                cap_to_product_keys.setdefault(cap_ref, []).append(
                    product.get("id", product["name"])
                )

        cap_id_map: dict[str, str] = {}   # BMAD capability key → DB capability id
        func_id_map: dict[str, str] = {}  # functionality name → DB functionality id

        for cap in capabilities:
            cap_key = cap.get("id", cap["name"])

            # Resolve parent product DB id
            product_db_id = None
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
            await db_pool.execute(
                """
                INSERT INTO digital_capabilities (id, digital_product_id, name, description,
                                                   category, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                """,
                cap_db_id,
                product_db_id,
                cap["name"],
                cap.get("description", ""),
                cap.get("category", ""),
            )

            # Insert functionalities nested under this capability
            for func_name in cap.get("functionalityNames", []):
                raw = func_raw_map.get(func_name, {
                    "name": func_name, "description": "", "sourceFiles": []
                })
                func_db_id = str(uuid.uuid4())
                func_id_map[func_name] = func_db_id
                await db_pool.execute(
                    """
                    INSERT INTO functionalities (id, digital_capability_id, name, description,
                                                 source_files, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5::text[], NOW(), NOW())
                    """,
                    func_db_id,
                    cap_db_id,
                    raw["name"],
                    raw.get("description", ""),
                    raw.get("sourceFiles", []),
                )

        # Fallback: insert any raw functionalities not yet captured under capabilities
        if not func_id_map and functionalities_raw:
            # Create a default capability to house them
            default_product_db_id = next(iter(product_id_map.values()), None)
            if default_product_db_id:
                default_cap_id = str(uuid.uuid4())
                await db_pool.execute(
                    """
                    INSERT INTO digital_capabilities (id, digital_product_id, name, description,
                                                       category, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                    """,
                    default_cap_id,
                    default_product_db_id,
                    "Core Capabilities",
                    "Auto-grouped capabilities from discovery",
                    "",
                )
                for func in functionalities_raw:
                    func_db_id = str(uuid.uuid4())
                    func_id_map[func["name"]] = func_db_id
                    await db_pool.execute(
                        """
                        INSERT INTO functionalities (id, digital_capability_id, name, description,
                                                     source_files, created_at, updated_at)
                        VALUES ($1, $2, $3, $4, $5::text[], NOW(), NOW())
                        """,
                        func_db_id,
                        default_cap_id,
                        func["name"],
                        func.get("description", ""),
                        func.get("sourceFiles", []),
                    )

        # Step 3: Insert persona mappings (linked to functionalities)
        for mapping in personas:
            func_name = mapping.get("functionality_name", "")
            func_db_id = func_id_map.get(func_name)
            if not func_db_id:
                # Fuzzy match by substring
                for name, fid in func_id_map.items():
                    if func_name and (
                        func_name.lower() in name.lower() or name.lower() in func_name.lower()
                    ):
                        func_db_id = fid
                        break
            if not func_db_id:
                continue
            await db_pool.execute(
                """
                INSERT INTO persona_mappings (id, functionality_id, persona_type, persona_name,
                                              responsibilities, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5::text[], NOW(), NOW())
                """,
                str(uuid.uuid4()),
                func_db_id,
                mapping.get("persona_type", ""),
                mapping.get("persona_name", ""),
                mapping.get("responsibilities", [mapping.get("capability_name", "")]),
            )

        logger.info("Discovery results persisted for repository %s", repository_id)
    except Exception as exc:
        logger.error("persist_results failed: %s", exc)
        return {"error": str(exc)}

    return {
        "results": {
            "repository_id": repository_id,
            "functionalities_count": len(func_id_map),
            "capabilities_count": len(cap_id_map),
            "products_count": len(product_id_map),
            "persona_mappings_count": len(personas),
            "brd_generated": bool(brd),
        }
    }


# ---------------------------------------------------------------------------
# Build the LangGraph StateGraph
# ---------------------------------------------------------------------------

graph = StateGraph(AgentState)

graph.add_node("parse_codebase", parse_codebase)
graph.add_node("extract_functionalities", extract_functionalities)
graph.add_node("generate_brd", generate_brd)
graph.add_node("cluster_bmad", cluster_bmad)
graph.add_node("map_personas", map_personas)
graph.add_node("persist_results", persist_results)

graph.set_entry_point("parse_codebase")
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
        logger.info("DiscoveryAgent starting with input keys: %s", list(input_data.keys()))
        initial_state: AgentState = {"input_data": input_data}

        try:
            final_state = await compiled_graph.ainvoke(initial_state)
        except Exception as exc:
            logger.error("DiscoveryAgent execution failed: %s", exc)
            return {"error": str(exc)}

        return final_state.get("results", {"error": final_state.get("error", "Unknown error")})
