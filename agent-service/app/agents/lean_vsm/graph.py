import json
import logging
import uuid
from typing import Any

from langgraph.graph import StateGraph

from app.agents.base import AgentState, BaseAgent
from app.core.database import db_pool
from app.agents.org_context import get_org_context, format_context_section, org_description
from app.agents.context_output import save_agent_context_doc
from app.agents.bm25_retrieval import bm25_rerank_for_agent
from app.services.claude_client import claude_client
from app.services.code_signals import extract_code_signals
from app.services.llm_router import llm_router
from app.services.llm_config import LIGHT_TASK_MODEL

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Node functions
# ---------------------------------------------------------------------------


async def load_capabilities(state: AgentState) -> dict[str, Any]:
    """Load digital capabilities from the database.

    Actual DB hierarchy:
      digital_products (repository_id)
        ├── digital_capabilities (digital_product_id)
        └── product_groups (digital_product_id)
              └── value_stream_steps (product_group_id)
    """
    input_data = state["input_data"]
    repository_id = input_data.get("repository_id")
    org_id = (input_data.get("organization") or {}).get("id")

    try:
        # Capabilities with their parent product
        cap_query = """
            SELECT dc.id AS cap_id, dc.name AS cap_name, dc.description AS cap_description,
                   dp.id AS product_id, dp.name AS product_name
            FROM digital_capabilities dc
            JOIN digital_products dp ON dp.id = dc.digital_product_id
        """
        # Steps via product_groups under the same product as the capability
        step_query = """
            SELECT dp.id AS product_id,
                   pg.id AS group_id, pg.name AS group_name,
                   vs.id AS step_id, vs.name AS step_name,
                   vs.description AS step_description, vs.step_order
            FROM product_groups pg
            JOIN digital_products dp ON dp.id = pg.digital_product_id
            LEFT JOIN value_stream_steps vs ON vs.product_group_id = pg.id
        """

        if repository_id:
            cap_query += " WHERE dp.repository_id = $1 ORDER BY dc.name"
            step_query += " WHERE dp.repository_id = $1 ORDER BY pg.name, vs.step_order"
            cap_rows = await db_pool.fetch(cap_query, repository_id)
            step_rows = await db_pool.fetch(step_query, repository_id)
        elif org_id:
            cap_query += " JOIN repositories r ON r.id = dp.repository_id WHERE r.organization_id = $1 ORDER BY dc.name"
            step_query += " JOIN repositories r ON r.id = dp.repository_id WHERE r.organization_id = $1 ORDER BY pg.name, vs.step_order"
            cap_rows = await db_pool.fetch(cap_query, org_id)
            step_rows = await db_pool.fetch(step_query, org_id)
        else:
            cap_query += " ORDER BY dc.name"
            step_query += " ORDER BY pg.name, vs.step_order"
            cap_rows = await db_pool.fetch(cap_query)
            step_rows = await db_pool.fetch(step_query)

        # Build product → groups → steps lookup
        product_groups_map: dict[str, dict] = {}
        for row in step_rows:
            pid = row["product_id"]
            if pid not in product_groups_map:
                product_groups_map[pid] = {}
            gid = row["group_id"]
            if gid not in product_groups_map[pid]:
                product_groups_map[pid][gid] = {
                    "id": gid,
                    "name": row["group_name"],
                    "steps": [],
                }
            if row["step_id"]:
                product_groups_map[pid][gid]["steps"].append({
                    "id": row["step_id"],
                    "name": row["step_name"],
                    "description": row["step_description"],
                    "order": row["step_order"],
                })

        # Build capabilities_map: capability → product + groups/steps from same product
        capabilities_map: dict[str, dict] = {}
        for row in cap_rows:
            cap_id = row["cap_id"]
            pid = row["product_id"]
            if cap_id not in capabilities_map:
                capabilities_map[cap_id] = {
                    "id": cap_id,
                    "name": row["cap_name"],
                    "description": row["cap_description"],
                    "products": {},
                }
            cap = capabilities_map[cap_id]
            if pid not in cap["products"]:
                groups = list(product_groups_map.get(pid, {}).values())
                cap["products"][pid] = {
                    "id": pid,
                    "name": row["product_name"],
                    "groups": {g["id"]: g for g in groups},
                }

        # Flatten nested dicts to lists for serialization
        capabilities_data = []
        for cap in capabilities_map.values():
            cap_entry = {**cap, "products": []}
            for prod in cap["products"].values():
                prod_entry = {**prod, "groups": []}
                for grp in prod["groups"].values():
                    prod_entry["groups"].append(grp)
                cap_entry["products"].append(prod_entry)
            capabilities_data.append(cap_entry)

        # Build step name → step id lookup for use in persist_vsm
        step_name_to_id: dict[str, str] = {}
        for row in step_rows:
            if row["step_id"] and row["step_name"]:
                step_name_to_id[row["step_name"].lower()] = row["step_id"]

        logger.info("Loaded %d capabilities for repository %s", len(capabilities_data), repository_id)
    except Exception as exc:
        logger.error("load_capabilities failed: %s", exc)
        capabilities_data = []
        step_name_to_id = {}

    return {
        "capabilities_data": capabilities_data,
        "repository_id": repository_id,
        "step_name_to_id": step_name_to_id,
    }


async def fetch_code_signals(state: AgentState) -> dict[str, Any]:
    """Tier 2a: Scan context document chunks for hard timing signals before LLM estimation."""
    input_data = state.get("input_data", {})
    capabilities_data = state.get("capabilities_data", [])

    # Collect all step names across all capabilities
    step_names: list[str] = []
    for cap in capabilities_data:
        for prod in cap.get("products", []):
            for grp in prod.get("groups", []):
                for step in grp.get("steps", []):
                    if step.get("name"):
                        step_names.append(step["name"])

    # Context chunks may be injected from the Next.js RAG pipeline
    context_chunks: list[dict] = input_data.get("contextDocuments", [])

    if not context_chunks or not step_names:
        return {"code_signals": {}}

    try:
        signals = extract_code_signals(context_chunks, step_names)
        logger.info("Tier 2a: extracted %d timing signals from %d chunks",
                    len(signals), len(context_chunks))
        return {"code_signals": signals}
    except Exception as exc:
        logger.warning("fetch_code_signals failed (non-fatal): %s", exc)
        return {"code_signals": {}}


async def analyze_flow(state: AgentState) -> dict[str, Any]:
    """Call Claude to analyze the value stream flow for each capability."""
    org = get_org_context(state["input_data"])
    state["input_data"] = bm25_rerank_for_agent(
        state["input_data"],
        "process time wait time lead time flow efficiency bottleneck VSM benchmarks lean waste"
    )
    ctx = format_context_section(state["input_data"], agent_type="lean_vsm")
    capabilities_data = state.get("capabilities_data", [])
    code_signals = state.get("code_signals", {})

    # Format code signals for the prompt (only include non-empty ones)
    code_signal_text = ""
    if code_signals:
        signal_lines = []
        for step_key, sig in code_signals.items():
            parts = []
            if sig.get("process_time_hrs") is not None:
                parts.append(f"process_time={sig['process_time_hrs']}h")
            if sig.get("wait_time_hrs") is not None:
                parts.append(f"wait_time={sig['wait_time_hrs']}h")
            if parts:
                evidence = "; ".join(sig.get("evidence", [])[:2])
                signal_lines.append(
                    f"  - '{step_key}': {', '.join(parts)} "
                    f"[confidence={sig.get('confidence', 0):.0%}] (from: {evidence})"
                )
        if signal_lines:
            code_signal_text = (
                "\n\nTIMING SIGNALS FROM CODE/DOCS (use these as anchors — "
                "only override if context clearly contradicts):\n"
                + "\n".join(signal_lines)
                + "\n"
            )

    prompt = (
        f"Analyze the value stream flow for the following digital capabilities "
        f"of {org_description(org)}:\n"
        f"{json.dumps(capabilities_data, indent=2)}\n\n"
        f"{ctx}"
        f"{code_signal_text}"
        f"For each capability and its value stream steps, identify:\n"
        f"- Which steps are value-adding (directly serve client needs)\n"
        f"- Which steps are bottlenecks (slow down the process)\n"
        f"- Which steps are waste (non-value-adding, could be eliminated or automated)\n"
        f"- process_time_hours: actual hands-on work time (value-add only, no waiting)\n"
        f"- lead_time_hours: total elapsed clock time including all queuing and waiting\n"
        f"  (wait_time = lead_time - process_time is derived from these two fields)\n"
        f"- automation_potential: 'high' (rule-based/ML feasible), 'medium' (partial), "
        f"  or 'low' (requires human judgement)\n\n"
        f"Return a JSON object with key 'capabilities' containing a list of:\n"
        f'{{"capability_name": str, "steps": [{{"step_name": str, "classification": '
        f'"value_adding"|"bottleneck"|"waste", "process_time_hours": float, '
        f'"lead_time_hours": float, "automation_potential": "high"|"medium"|"low", '
        f'"improvement_suggestion": str}}]}}'
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=8192)
        flow_analysis = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("analyze_flow failed: %s", exc)
        flow_analysis = {"capabilities": []}

    return {"flow_analysis": flow_analysis}


async def calculate_metrics(state: AgentState) -> dict[str, Any]:
    """Calculate PT, LT, WT, and FE metrics for each capability and step."""
    flow_analysis = state.get("flow_analysis", {})
    capabilities = flow_analysis.get("capabilities", [])

    metrics: dict[str, Any] = {"capabilities": []}

    for cap in capabilities:
        cap_name = cap.get("capability_name", "Unknown")
        steps = cap.get("steps", [])

        total_pt = sum(s.get("process_time_hours", 0.0) for s in steps)
        total_lt = sum(s.get("lead_time_hours", 0.0) for s in steps)
        total_wt = total_lt - total_pt
        flow_efficiency = (total_pt / total_lt * 100) if total_lt > 0 else 0.0

        step_metrics = []
        for step in steps:
            pt = step.get("process_time_hours", 0.0)
            lt = step.get("lead_time_hours", 0.0)
            wt = max(lt - pt, 0.0)
            fe = (pt / lt * 100) if lt > 0 else 0.0
            step_metrics.append({
                "step_name": step.get("step_name", ""),
                "classification": step.get("classification", "value_adding"),
                "process_time_hours": round(pt, 2),
                "lead_time_hours": round(lt, 2),
                "wait_time_hours": round(wt, 2),
                "flow_efficiency_pct": round(fe, 2),
                "automation_potential": step.get("automation_potential", "medium"),
                "improvement_suggestion": step.get("improvement_suggestion", ""),
            })

        metrics["capabilities"].append({
            "capability_name": cap_name,
            "total_process_time_hours": round(total_pt, 2),
            "total_lead_time_hours": round(total_lt, 2),
            "total_wait_time_hours": round(total_wt, 2),
            "flow_efficiency_pct": round(flow_efficiency, 2),
            "steps": step_metrics,
        })

    return {"metrics": metrics}


async def generate_mermaid(state: AgentState) -> dict[str, Any]:
    """Generate a Mermaid flowchart with color coding for the value stream."""
    org = get_org_context(state["input_data"])
    metrics = state.get("metrics", {})

    prompt = (
        f"Generate a Mermaid flowchart for the following value stream metrics "
        f"of {org_description(org)}:\n"
        f"{json.dumps(metrics, indent=2)}\n\n"
        f"Requirements:\n"
        f"- Use 'graph LR' (left-to-right) format\n"
        f"- Color code steps using classDef:\n"
        f"  - classDef valueAdding fill:#22c55e,stroke:#16a34a,color:#fff (green for value-adding)\n"
        f"  - classDef bottleneck fill:#f59e0b,stroke:#d97706,color:#fff (amber for bottlenecks)\n"
        f"  - classDef waste fill:#ef4444,stroke:#dc2626,color:#fff (red for waste)\n"
        f"- Each step node should show: step name | PT: Xh | LT: Xh | FE: X%\n"
        f"- Connect steps with arrows annotated with wait time: -->|WT: Xh|\n"
        f"- Group by capability using subgraph blocks\n\n"
        f"Return ONLY the Mermaid source code as a plain string, no markdown fencing."
    )

    try:
        # Use the light-task model (Haiku) — Mermaid generation is a formatting
        # task that doesn't require reasoning capability; ~10-15x cheaper.
        mermaid_source = await llm_router.analyze(
            prompt,
            max_tokens=4096,
            model_preference=LIGHT_TASK_MODEL,
        )
        # Strip any accidental markdown fencing
        mermaid_source = mermaid_source.strip()
        if mermaid_source.startswith("```"):
            lines = mermaid_source.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            mermaid_source = "\n".join(lines).strip()
    except Exception as exc:
        logger.error("generate_mermaid failed: %s", exc)
        mermaid_source = "graph LR\n  A[Error generating diagram]"

    return {"mermaid_source": mermaid_source}


async def persist_vsm(state: AgentState) -> dict[str, Any]:
    """Write VSM metrics to the database — both capability-level aggregates and per-step timing."""
    repository_id = state.get("repository_id")
    metrics = state.get("metrics", {})
    mermaid_source = state.get("mermaid_source", "")
    step_name_to_id: dict[str, str] = state.get("step_name_to_id", {})
    code_signals: dict[str, dict] = state.get("code_signals", {})

    try:
        # Build name → id lookup for capabilities in this repository
        if repository_id:
            cap_name_rows = await db_pool.fetch(
                """
                SELECT dc.id, dc.name
                FROM digital_capabilities dc
                JOIN digital_products dp ON dp.id = dc.digital_product_id
                WHERE dp.repository_id = $1
                """,
                repository_id,
            )
        else:
            cap_name_rows = await db_pool.fetch(
                "SELECT id, name FROM digital_capabilities"
            )
        cap_name_to_id = {r["name"].lower(): r["id"] for r in cap_name_rows}

        steps_updated = 0

        for cap in metrics.get("capabilities", []):
            cap_name = cap.get("capability_name", "")
            # Resolve capability id by exact name, then fuzzy
            cap_id = cap_name_to_id.get(cap_name.lower())
            if not cap_id:
                for name, cid in cap_name_to_id.items():
                    if cap_name.lower() in name or name in cap_name.lower():
                        cap_id = cid
                        break
            if not cap_id:
                logger.warning("VSM: no DB id found for capability '%s', skipping metric", cap_name)
                continue

            total_pt = cap.get("total_process_time_hours", cap.get("total_process_time", 0.0))
            total_lt = cap.get("total_lead_time_hours", cap.get("total_lead_time", 0.0))
            total_wt = cap.get("total_wait_time_hours", total_lt - total_pt)
            fe = cap.get("flow_efficiency_pct", (total_pt / total_lt * 100) if total_lt > 0 else 0.0)

            # ── Capability-level aggregate (vsm_metrics) ──────────────────────
            await db_pool.execute(
                """
                INSERT INTO vsm_metrics (
                    id, digital_capability_id, process_time, lead_time,
                    wait_time, flow_efficiency, mermaid_source,
                    created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                ON CONFLICT DO NOTHING
                """,
                str(uuid.uuid4()),
                cap_id,
                total_pt,
                total_lt,
                total_wt,
                fe,
                mermaid_source,
            )

            # ── Per-step timing (value_stream_steps) ──────────────────────────
            for step in cap.get("steps", []):
                step_name = step.get("step_name", "")
                if not step_name:
                    continue

                # Resolve step id: exact match first, then fuzzy
                step_id = step_name_to_id.get(step_name.lower())
                if not step_id:
                    for sname, sid in step_name_to_id.items():
                        if step_name.lower() in sname or sname in step_name.lower():
                            step_id = sid
                            break
                if not step_id:
                    logger.debug("VSM: step '%s' not found in DB (may be LLM-inferred), skipping step update", step_name)
                    continue

                try:
                    # Check if code signals provide higher-confidence timing
                    sig = code_signals.get(step_name.lower(), {})
                    pt = sig.get("process_time_hrs") or step.get("process_time_hours", 0.0)
                    wt = sig.get("wait_time_hrs") or step.get("wait_time_hours", 0.0)
                    lt = step.get("lead_time_hours", 0.0)
                    timing_source = sig.get("source", "llm_estimated") if sig else "llm_estimated"
                    timing_confidence = sig.get("confidence", 0.6) if sig else 0.6

                    await db_pool.execute(
                        """
                        UPDATE value_stream_steps
                        SET process_time_hrs   = $1,
                            wait_time_hrs      = $2,
                            lead_time_hrs      = $3,
                            flow_efficiency    = $4,
                            classification     = $5,
                            improvement_note   = $6,
                            timing_source      = $7,
                            timing_confidence  = $8,
                            updated_at         = NOW()
                        WHERE id = $9
                        """,
                        pt,
                        wt,
                        lt,
                        step.get("flow_efficiency_pct", 0.0),
                        step.get("classification", "value_adding"),
                        step.get("improvement_suggestion", ""),
                        timing_source,
                        timing_confidence,
                        step_id,
                    )
                    steps_updated += 1
                except Exception as step_exc:
                    logger.warning("VSM: failed to update step '%s': %s (non-fatal)", step_name, step_exc)

        logger.info(
            "VSM persisted for repo %s — %d capability aggregates, %d steps updated",
            repository_id, len(metrics.get("capabilities", [])), steps_updated,
        )

        # Confidence propagation: boost capability confidence for VSM-validated ones
        try:
            await db_pool.execute(
                """
                UPDATE digital_capabilities
                SET confidence = LEAST(1.0, confidence + 0.10),
                    updated_at = NOW()
                WHERE id IN (
                    SELECT digital_capability_id FROM vsm_metrics
                    WHERE digital_capability_id IN (
                        SELECT dc.id FROM digital_capabilities dc
                        JOIN digital_products dp ON dp.id = dc.digital_product_id
                        WHERE dp.repository_id = $1
                    )
                )
                AND confidence IS NOT NULL
                """,
                repository_id,
            )
            logger.info("Boosted confidence for VSM-validated capabilities in repo %s", repository_id)
        except Exception as boost_exc:
            logger.warning("Confidence boost after VSM failed (non-fatal): %s", boost_exc)

    except Exception as exc:
        logger.error("persist_vsm failed: %s", exc)
        return {"error": str(exc)}

    # Auto-save VSM output for cross-agent chaining
    org = state["input_data"].get("organization", {})
    org_id = str(org.get("id", ""))
    org_name = org.get("name", "Enterprise")
    if org_id:
        caps = metrics.get("capabilities", [])
        await save_agent_context_doc(
            "lean_vsm", org_id, org_name,
            {"capabilities_count": len(caps), "metrics": caps[:20],
             "product_name": state["input_data"].get("product_name", "")},
        )

    # P2: Record anonymised benchmark data for cross-org aggregation
    if org_id:
        try:
            from app.services.benchmark_aggregation import record_vsm_benchmark
            industry_type = org.get("industryType") or org.get("industry_type", "")
            if industry_type:
                await record_vsm_benchmark(org_id, industry_type, metrics)
        except Exception as bench_exc:
            logger.debug("benchmark_aggregation non-fatal: %s", bench_exc)

    return {
        "results": {
            "repository_id": repository_id,
            "capabilities_analyzed": len(metrics.get("capabilities", [])),
            "steps_updated": steps_updated if "steps_updated" in dir() else 0,
            "mermaid_generated": bool(mermaid_source),
            "metrics": metrics,
        }
    }


# ---------------------------------------------------------------------------
# Build the LangGraph StateGraph
# ---------------------------------------------------------------------------

graph = StateGraph(AgentState)

graph.add_node("load_capabilities", load_capabilities)
graph.add_node("fetch_code_signals", fetch_code_signals)
graph.add_node("analyze_flow", analyze_flow)
graph.add_node("calculate_metrics", calculate_metrics)
graph.add_node("generate_mermaid", generate_mermaid)
graph.add_node("persist_vsm", persist_vsm)

graph.set_entry_point("load_capabilities")
graph.add_edge("load_capabilities", "fetch_code_signals")
graph.add_edge("fetch_code_signals", "analyze_flow")
graph.add_edge("analyze_flow", "calculate_metrics")
graph.add_edge("calculate_metrics", "generate_mermaid")
graph.add_edge("generate_mermaid", "persist_vsm")
graph.set_finish_point("persist_vsm")

compiled_graph = graph.compile()


# ---------------------------------------------------------------------------
# Agent class
# ---------------------------------------------------------------------------


class LeanVsmAgent(BaseAgent):
    def get_name(self) -> str:
        return "lean_vsm"

    async def run(self, input_data: dict[str, Any]) -> dict[str, Any]:
        logger.info("LeanVsmAgent starting with input keys: %s", list(input_data.keys()))
        initial_state: AgentState = {"input_data": input_data}

        try:
            final_state = await compiled_graph.ainvoke(initial_state)
        except Exception as exc:
            logger.error("LeanVsmAgent execution failed: %s", exc)
            return {"error": str(exc)}

        return final_state.get("results", {"error": final_state.get("error", "Unknown error")})
