import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from langgraph.graph import StateGraph

from app.agents.base import AgentState, BaseAgent
from app.core.crypto import compute_payload_hash
from app.core.database import db_pool
from app.agents.org_context import get_org_context, format_context_section, org_description
from app.services.claude_client import claude_client

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Node functions
# ---------------------------------------------------------------------------


async def load_repository_context(state: AgentState) -> dict[str, Any]:
    """Load repository info, functionalities, source file mappings."""
    input_data = state["input_data"]
    repository_id = input_data.get("repository_id")

    try:
        repo_info = {}
        if repository_id:
            row = await db_pool.fetchrow(
                "SELECT id, name, url, description FROM repositories WHERE id = $1",
                repository_id,
            )
            if row:
                repo_info = dict(row)

            functionalities = await db_pool.fetch(
                """
                SELECT f.id, f.name, f.description, f.source_files
                FROM functionalities f
                JOIN digital_capabilities dc ON dc.id = f.digital_capability_id
                JOIN digital_products dp ON dp.id = dc.digital_product_id
                WHERE dp.repository_id = $1
                """,
                repository_id,
            )

            capabilities = await db_pool.fetch(
                """
                SELECT dc.id, dc.name, dc.description, dc.category
                FROM digital_capabilities dc
                JOIN digital_products dp ON dp.id = dc.digital_product_id
                WHERE dp.repository_id = $1
                """,
                repository_id,
            )
        elif org_id := (input_data.get("organization") or {}).get("id"):
            functionalities = await db_pool.fetch(
                """
                SELECT f.id, f.name, f.description, f.source_files
                FROM functionalities f
                JOIN digital_capabilities dc ON dc.id = f.digital_capability_id
                JOIN digital_products dp ON dp.id = dc.digital_product_id
                JOIN repositories r ON r.id = dp.repository_id
                WHERE r.organization_id = $1
                """,
                org_id,
            )
            capabilities = await db_pool.fetch(
                """
                SELECT dc.id, dc.name, dc.description, dc.category
                FROM digital_capabilities dc
                JOIN digital_products dp ON dp.id = dc.digital_product_id
                JOIN repositories r ON r.id = dp.repository_id
                WHERE r.organization_id = $1
                """,
                org_id,
            )
        else:
            functionalities = await db_pool.fetch(
                "SELECT id, name, description, source_files FROM functionalities"
            )
            capabilities = await db_pool.fetch(
                "SELECT id, name, description, category FROM digital_capabilities"
            )

        repo_context = {
            "repository_id": repository_id,
            "repository_info": repo_info,
            "functionalities": [dict(r) for r in functionalities],
            "capabilities": [dict(r) for r in capabilities],
        }

        logger.info(
            "Loaded repo context: %d functionalities, %d capabilities",
            len(functionalities),
            len(capabilities),
        )
    except Exception as exc:
        logger.error("load_repository_context failed: %s", exc)
        repo_context = {
            "repository_id": repository_id,
            "repository_info": {},
            "functionalities": [],
            "capabilities": [],
        }

    return {"repo_context": repo_context, "repository_id": repository_id}


async def analyze_current_architecture(state: AgentState) -> dict[str, Any]:
    """Analyze the current monolith architecture -- coupling, cohesion, dependencies."""
    org = get_org_context(state["input_data"])
    ctx = format_context_section(state["input_data"])
    repo_context = state.get("repo_context", {})

    prompt = (
        f"Analyze the current architecture of {org_description(org)} based on "
        f"the following repository information:\n\n"
        f"Repository: {json.dumps(repo_context.get('repository_info', {}), indent=2)}\n\n"
        f"Functionalities:\n{json.dumps(repo_context.get('functionalities', []), indent=2, default=str)}\n\n"
        f"Digital Capabilities:\n{json.dumps(repo_context.get('capabilities', []), indent=2)}\n\n"
        f"{ctx}"
        f"Analyze:\n"
        f"- Module coupling (tight vs loose) between functionalities\n"
        f"- Cohesion within each module\n"
        f"- Dependency graph between components\n"
        f"- Database coupling patterns\n"
        f"- Integration patterns (sync vs async, point-to-point vs bus)\n"
        f"- Scalability bottlenecks\n\n"
        f"Return a JSON object with:\n"
        f"architecture_style (monolith | modular_monolith | distributed), "
        f"coupling_score (1-10, 10=tightly coupled), "
        f"cohesion_score (1-10, 10=highly cohesive), "
        f"modules (list of {{name, responsibilities, dependencies, coupling_level}}), "
        f"pain_points (list of strings), "
        f"strengths (list of strings)."
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=8192)
        current_architecture = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("analyze_current_architecture failed: %s", exc)
        current_architecture = {
            "architecture_style": "unknown",
            "coupling_score": 0,
            "cohesion_score": 0,
            "modules": [],
            "pain_points": [],
            "strengths": [],
        }

    return {"current_architecture": current_architecture}


async def design_target_architecture(state: AgentState) -> dict[str, Any]:
    """Design microservices decomposition aligned with BMAD capabilities."""
    org = get_org_context(state["input_data"])
    repo_context = state.get("repo_context", {})
    current_architecture = state.get("current_architecture", {})

    prompt = (
        f"Design a target microservices architecture for {org_description(org)} "
        f"transformation:\n\n"
        f"Current Architecture:\n{json.dumps(current_architecture, indent=2)}\n\n"
        f"BMAD Capabilities:\n{json.dumps(repo_context.get('capabilities', []), indent=2)}\n\n"
        f"Design a target architecture with:\n"
        f"- Microservices decomposition aligned with business capabilities (DDD bounded contexts)\n"
        f"- API gateway pattern for client access\n"
        f"- Event-driven architecture for inter-service communication\n"
        f"- CQRS where applicable for read/write separation\n"
        f"- Shared nothing database architecture\n\n"
        f"Return a JSON object with:\n"
        f"architecture_style, "
        f"services (list of {{name, bounded_context, responsibilities, api_endpoints, "
        f"database, events_published, events_consumed, technology_stack}}), "
        f"shared_infrastructure (list of {{name, purpose, technology}}), "
        f"api_gateway ({{routes, auth_strategy, rate_limiting}}), "
        f"event_bus ({{technology, topics}})."
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=8192)
        target_architecture = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("design_target_architecture failed: %s", exc)
        target_architecture = {"architecture_style": "microservices", "services": []}

    return {"target_architecture": target_architecture}


async def plan_migration_path(state: AgentState) -> dict[str, Any]:
    """Create phased migration plan (strangler fig pattern) with risk assessment."""
    org = get_org_context(state["input_data"])
    current_architecture = state.get("current_architecture", {})
    target_architecture = state.get("target_architecture", {})

    prompt = (
        f"Create a phased migration plan from the current to target architecture "
        f"for {org_description(org)} using the Strangler Fig pattern:\n\n"
        f"Current Architecture:\n{json.dumps(current_architecture, indent=2)}\n\n"
        f"Target Architecture:\n{json.dumps(target_architecture, indent=2)}\n\n"
        f"Create a migration plan with:\n"
        f"- Phases (each phase extracts 1-3 services from the monolith)\n"
        f"- Strangler fig approach: route traffic gradually from monolith to new service\n"
        f"- Risk assessment per phase\n"
        f"- Rollback strategy per phase\n"
        f"- Data migration strategy\n"
        f"- Testing strategy (contract testing, canary releases)\n\n"
        f"Return a JSON object with:\n"
        f"total_phases (int), estimated_duration_months (int), "
        f"phases (list of {{phase_number, name, description, services_to_extract, "
        f"risk_level (LOW | MEDIUM | HIGH), rollback_strategy, "
        f"data_migration_approach, testing_approach, dependencies}}), "
        f"critical_success_factors (list of strings)."
    )

    try:
        raw = await claude_client.analyze_structured(prompt, max_tokens=8192)
        migration_plan = json.loads(raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("plan_migration_path failed: %s", exc)
        migration_plan = {"total_phases": 0, "phases": []}

    return {"migration_plan": migration_plan}


async def generate_architecture_diagrams(state: AgentState) -> dict[str, Any]:
    """Generate Mermaid C4/architecture diagrams for current and target state."""
    org = get_org_context(state["input_data"])
    current_architecture = state.get("current_architecture", {})
    target_architecture = state.get("target_architecture", {})
    migration_plan = state.get("migration_plan", {})

    prompt = (
        f"Generate Mermaid diagrams for {org_description(org)} architecture "
        f"transformation:\n\n"
        f"Current Architecture:\n{json.dumps(current_architecture, indent=2)}\n\n"
        f"Target Architecture:\n{json.dumps(target_architecture, indent=2)}\n\n"
        f"Migration Plan:\n{json.dumps(migration_plan, indent=2)}\n\n"
        f"Generate THREE Mermaid diagrams separated by '---DIAGRAM---':\n"
        f"1. Current State C4 Context diagram (graph TB)\n"
        f"2. Target State microservices architecture (graph LR)\n"
        f"3. Migration phases timeline (gantt)\n\n"
        f"Use classDef for color coding:\n"
        f"- classDef monolith fill:#ef4444,stroke:#dc2626,color:#fff\n"
        f"- classDef service fill:#22c55e,stroke:#16a34a,color:#fff\n"
        f"- classDef gateway fill:#3b82f6,stroke:#2563eb,color:#fff\n"
        f"- classDef database fill:#f59e0b,stroke:#d97706,color:#fff\n\n"
        f"Return ONLY the Mermaid source code as plain text, no markdown fencing."
    )

    try:
        raw_diagrams = await claude_client.analyze(prompt, max_tokens=8192)
        raw_diagrams = raw_diagrams.strip()
        if raw_diagrams.startswith("```"):
            lines = raw_diagrams.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            raw_diagrams = "\n".join(lines).strip()

        # Parse ---DIAGRAM--- separated string into dict
        parts = raw_diagrams.split("---DIAGRAM---")
        architecture_diagrams = {
            "functional": parts[0].strip() if len(parts) > 0 else "",
            "technical": parts[1].strip() if len(parts) > 1 else "",
            "solution": parts[2].strip() if len(parts) > 2 else "",
        }
    except Exception as exc:
        logger.error("generate_architecture_diagrams failed: %s", exc)
        architecture_diagrams = {
            "functional": "graph LR\n  A[Error generating diagrams]",
            "technical": "",
            "solution": "",
        }

    return {"architecture_diagrams": architecture_diagrams}


async def persist_architecture(state: AgentState) -> dict[str, Any]:
    """Write risk assessments for migration + audit log entries."""
    repository_id = state.get("repository_id")
    migration_plan = state.get("migration_plan", {})
    current_architecture = state.get("current_architecture", {})
    target_architecture = state.get("target_architecture", {})
    architecture_diagrams = state.get("architecture_diagrams", "")

    try:
        # Insert risk assessments for each migration phase
        for phase in migration_plan.get("phases", []):
            assessment_id = str(uuid.uuid4())
            risk_level = phase.get("risk_level", "MEDIUM")
            risk_score = {"LOW": 3.0, "MEDIUM": 5.5, "HIGH": 8.0}.get(risk_level, 5.0)
            severity = {"LOW": "LOW", "MEDIUM": "MEDIUM", "HIGH": "HIGH"}.get(risk_level, "MEDIUM")

            await db_pool.execute(
                """
                INSERT INTO risk_assessments (
                    id, entity_type, entity_id,
                    risk_category, risk_score, severity,
                    description, mitigation_plan, transition_blocked,
                    created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
                """,
                assessment_id,
                "MigrationPhase",
                assessment_id,
                "TECHNOLOGY",
                risk_score,
                severity,
                f"Phase {phase.get('phase_number', 0)}: {phase.get('name', '')} - {phase.get('description', '')}",
                phase.get("rollback_strategy", "") if isinstance(phase.get("rollback_strategy"), str) else json.dumps(phase.get("rollback_strategy", "")),
                risk_level == "HIGH",
            )

        # Build audit chain
        previous_hash: str | None = None

        arch_payload = {
            "action": "ARCHITECTURE_ANALYZED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "architecture_style": current_architecture.get("architecture_style", "unknown"),
            "coupling_score": current_architecture.get("coupling_score", 0),
        }
        arch_hash = compute_payload_hash(arch_payload, previous_hash)
        audit_id_1 = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO audit_logs (
                id, action, entity_type, entity_id, actor,
                payload, payload_hash, previous_hash, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
            """,
            audit_id_1,
            "ARCHITECTURE_ANALYZED",
            "AgentExecution",
            repository_id or audit_id_1,
            "architecture-agent",
            json.dumps(arch_payload, default=str),
            arch_hash,
            previous_hash,
        )
        previous_hash = arch_hash

        target_payload = {
            "action": "TARGET_ARCHITECTURE_DESIGNED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "services_count": len(target_architecture.get("services", [])),
        }
        target_hash = compute_payload_hash(target_payload, previous_hash)
        audit_id_2 = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO audit_logs (
                id, action, entity_type, entity_id, actor,
                payload, payload_hash, previous_hash, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
            """,
            audit_id_2,
            "TARGET_ARCHITECTURE_DESIGNED",
            "AgentExecution",
            repository_id or audit_id_2,
            "architecture-agent",
            json.dumps(target_payload, default=str),
            target_hash,
            previous_hash,
        )
        previous_hash = target_hash

        migration_payload = {
            "action": "MIGRATION_PLAN_CREATED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "total_phases": migration_plan.get("total_phases", 0),
            "estimated_duration_months": migration_plan.get("estimated_duration_months", 0),
        }
        migration_hash = compute_payload_hash(migration_payload, previous_hash)
        audit_id_3 = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO audit_logs (
                id, action, entity_type, entity_id, actor,
                payload, payload_hash, previous_hash, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
            """,
            audit_id_3,
            "MIGRATION_PLAN_CREATED",
            "AgentExecution",
            repository_id or audit_id_3,
            "architecture-agent",
            json.dumps(migration_payload, default=str),
            migration_hash,
            previous_hash,
        )

        logger.info(
            "Architecture results persisted: %d migration phases",
            len(migration_plan.get("phases", [])),
        )
    except Exception as exc:
        logger.error("persist_architecture failed: %s", exc)
        return {"error": str(exc)}

    return {
        "results": {
            "repository_id": repository_id,
            "architecture_style": current_architecture.get("architecture_style", "unknown"),
            "target_services_count": len(target_architecture.get("services", [])),
            "migration_phases_count": len(migration_plan.get("phases", [])),
            "diagrams_generated": bool(architecture_diagrams),
            "current_architecture": current_architecture,
            "target_architecture": target_architecture,
            "migration_plan": migration_plan,
            "architecture_diagrams": architecture_diagrams,
        }
    }


# ---------------------------------------------------------------------------
# Build the LangGraph StateGraph
# ---------------------------------------------------------------------------

graph = StateGraph(AgentState)

graph.add_node("load_repository_context", load_repository_context)
graph.add_node("analyze_current_architecture", analyze_current_architecture)
graph.add_node("design_target_architecture", design_target_architecture)
graph.add_node("plan_migration_path", plan_migration_path)
graph.add_node("generate_architecture_diagrams", generate_architecture_diagrams)
graph.add_node("persist_architecture", persist_architecture)

graph.set_entry_point("load_repository_context")
graph.add_edge("load_repository_context", "analyze_current_architecture")
graph.add_edge("analyze_current_architecture", "design_target_architecture")
graph.add_edge("design_target_architecture", "plan_migration_path")
graph.add_edge("plan_migration_path", "generate_architecture_diagrams")
graph.add_edge("generate_architecture_diagrams", "persist_architecture")
graph.set_finish_point("persist_architecture")

compiled_graph = graph.compile()


# ---------------------------------------------------------------------------
# Agent class
# ---------------------------------------------------------------------------


class ArchitectureAgent(BaseAgent):
    def get_name(self) -> str:
        return "architecture"

    async def run(self, input_data: dict[str, Any]) -> dict[str, Any]:
        logger.info("ArchitectureAgent starting with input keys: %s", list(input_data.keys()))
        initial_state: AgentState = {"input_data": input_data}

        try:
            final_state = await compiled_graph.ainvoke(initial_state)
        except Exception as exc:
            logger.error("ArchitectureAgent execution failed: %s", exc)
            return {"error": str(exc)}

        return final_state.get("results", {"error": final_state.get("error", "Unknown error")})
