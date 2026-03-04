import logging
import os
import shutil
import tempfile
from typing import Any

import git

logger = logging.getLogger(__name__)


class GitService:
    def __init__(self):
        self._clone_dir = tempfile.mkdtemp(prefix="transformhub-git-")

    async def clone(self, repo_url: str) -> str:
        repo_name = repo_url.rstrip("/").split("/")[-1].replace(".git", "")
        clone_path = os.path.join(self._clone_dir, repo_name)

        if os.path.exists(clone_path):
            shutil.rmtree(clone_path)

        logger.info("Cloning %s to %s", repo_url, clone_path)
        git.Repo.clone_from(repo_url, clone_path, depth=1)
        return clone_path

    async def list_files(self, repo_path: str, extensions: list[str] | None = None) -> list[str]:
        files = []
        for root, dirs, filenames in os.walk(repo_path):
            # Skip hidden dirs and common non-code dirs
            dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("node_modules", "__pycache__", "venv", ".git")]
            for f in filenames:
                if extensions:
                    if any(f.endswith(ext) for ext in extensions):
                        files.append(os.path.join(root, f))
                else:
                    files.append(os.path.join(root, f))
        return files

    async def read_file(self, file_path: str, max_size: int = 100_000) -> str:
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                return f.read(max_size)
        except Exception as e:
            logger.warning("Could not read %s: %s", file_path, e)
            return ""

    async def extract_api_schemas(self, repo_path: str) -> list[dict[str, Any]]:
        schemas = []
        # Look for OpenAPI/Swagger files
        for name in ["openapi.json", "openapi.yaml", "swagger.json", "swagger.yaml"]:
            path = os.path.join(repo_path, name)
            if os.path.exists(path):
                content = await self.read_file(path)
                schemas.append({"file": name, "content": content[:10000]})

        return schemas

    async def cleanup(self, repo_path: str | None = None) -> None:
        path = repo_path or self._clone_dir
        if os.path.exists(path):
            shutil.rmtree(path, ignore_errors=True)
            logger.info("Cleaned up %s", path)


git_service = GitService()
