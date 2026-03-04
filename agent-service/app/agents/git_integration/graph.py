import logging
from typing import Any

from langgraph.graph import StateGraph, END

from app.agents.base import AgentState, BaseAgent
from app.agents.org_context import format_context_section
from app.services.claude_client import claude_client
from app.services.git_service import git_service
from app.services.embeddings import embed_and_store

logger = logging.getLogger(__name__)


async def clone_repo(state: AgentState) -> dict:
    input_data = state["input_data"]
    repo_url = input_data.get("repository_url", "")
    if not repo_url:
        return {"error": "repository_url is required"}
    repo_path = await git_service.clone(repo_url)
    return {"results": {**state.get("results", {}), "repo_path": repo_path}}


async def scan_files(state: AgentState) -> dict:
    repo_path = state.get("results", {}).get("repo_path", "")
    code_extensions = [".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".go", ".rs", ".rb"]
    files = await git_service.list_files(repo_path, extensions=code_extensions)
    return {"results": {**state.get("results", {}), "files": files[:200], "file_count": len(files)}}


async def extract_apis(state: AgentState) -> dict:
    repo_path = state.get("results", {}).get("repo_path", "")
    schemas = await git_service.extract_api_schemas(repo_path)

    # Also scan for route patterns
    files = state.get("results", {}).get("files", [])
    route_files = [f for f in files if any(k in f for k in ["route", "api", "controller", "endpoint"])]

    api_contents = []
    for f in route_files[:10]:
        content = await git_service.read_file(f)
        if content:
            api_contents.append({"file": f, "content": content[:2000]})

    return {"results": {**state.get("results", {}), "api_schemas": schemas, "api_files": api_contents}}


async def parse_dependencies(state: AgentState) -> dict:
    repo_path = state.get("results", {}).get("repo_path", "")
    ctx = format_context_section(state["input_data"])
    dep_files = {}
    for dep_name in ["package.json", "requirements.txt", "pyproject.toml", "go.mod", "Cargo.toml", "Gemfile"]:
        import os
        path = os.path.join(repo_path, dep_name)
        if os.path.exists(path):
            content = await git_service.read_file(path, max_size=10000)
            dep_files[dep_name] = content

    analysis = await claude_client.analyze_structured(
        prompt=f"Analyze these dependency files and identify: tech stack, key frameworks, languages. Return JSON with keys: languages, frameworks, dependencies_count.\n\n{dep_files}\n{ctx}",
        system="You are a code analysis expert. Always respond with valid JSON.",
    )

    return {"results": {**state.get("results", {}), "dependency_analysis": analysis}}


async def embed_code(state: AgentState) -> dict:
    repo_path = state.get("results", {}).get("repo_path", "")
    repository_id = state.get("repository_id")
    files = state.get("results", {}).get("files", [])

    if not repository_id:
        return {"results": {**state.get("results", {}), "embeddings_created": 0}}

    total_embedded = 0
    for f in files[:50]:  # Limit to 50 files for embedding
        content = await git_service.read_file(f)
        if content and len(content) > 50:
            relative_path = f.replace(repo_path, "").lstrip("/")
            count = await embed_and_store(repository_id, relative_path, content)
            total_embedded += count

    return {"results": {**state.get("results", {}), "embeddings_created": total_embedded}}


async def persist_results(state: AgentState) -> dict:
    # Cleanup cloned repo
    repo_path = state.get("results", {}).get("repo_path", "")
    if repo_path:
        await git_service.cleanup(repo_path)

    results = state.get("results", {})
    results.pop("repo_path", None)  # Don't expose local paths

    return {
        "results": {
            "file_count": results.get("file_count", 0),
            "api_schemas_found": len(results.get("api_schemas", [])),
            "api_files_found": len(results.get("api_files", [])),
            "dependency_analysis": results.get("dependency_analysis", "{}"),
            "embeddings_created": results.get("embeddings_created", 0),
        }
    }


class GitIntegrationAgent(BaseAgent):
    def get_name(self) -> str:
        return "Git Integration"

    async def run(self, input_data: dict[str, Any]) -> dict[str, Any]:
        workflow = StateGraph(AgentState)

        workflow.add_node("clone_repo", clone_repo)
        workflow.add_node("scan_files", scan_files)
        workflow.add_node("extract_apis", extract_apis)
        workflow.add_node("parse_dependencies", parse_dependencies)
        workflow.add_node("embed_code", embed_code)
        workflow.add_node("persist_results", persist_results)

        workflow.set_entry_point("clone_repo")
        workflow.add_edge("clone_repo", "scan_files")
        workflow.add_edge("scan_files", "extract_apis")
        workflow.add_edge("extract_apis", "parse_dependencies")
        workflow.add_edge("parse_dependencies", "embed_code")
        workflow.add_edge("embed_code", "persist_results")
        workflow.add_edge("persist_results", END)

        compiled = workflow.compile()
        result = await compiled.ainvoke({
            "input_data": input_data,
            "repository_id": input_data.get("repository_id"),
            "results": {},
        })

        return result.get("results", {})
