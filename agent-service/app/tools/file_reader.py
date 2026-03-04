"""
File reading tool for agent access to cloned repository files.

Provides safe, sandboxed file reading restricted to allowed base directories
(typically the cloned repo workspace).
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

from app.tools.base import BaseTool

logger = logging.getLogger(__name__)

# Base directories where cloned repos live — files outside are rejected
_ALLOWED_BASE_DIRS = [
    "/tmp/transformhub-repos",
    "/tmp/agent-workspace",
]

_MAX_FILE_SIZE_BYTES = 512 * 1024  # 512 KB
_MAX_LINE_COUNT = 5000


class FileReaderTool(BaseTool):
    """Read the contents of a file from a cloned repository."""

    @property
    def name(self) -> str:
        return "file_reader"

    @property
    def description(self) -> str:
        return (
            "Read the contents of a file from a cloned repository on the server. "
            "You must provide the full file path. Only files within the cloned "
            "repository workspace are accessible. Useful for reading source code, "
            "configuration files, documentation, or dependency manifests."
        )

    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "Absolute path to the file to read.",
                },
                "start_line": {
                    "type": "integer",
                    "description": "Optional 1-based start line (for partial reads).",
                    "default": 1,
                },
                "end_line": {
                    "type": "integer",
                    "description": (
                        "Optional 1-based end line (inclusive). "
                        "Defaults to reading the entire file."
                    ),
                },
            },
            "required": ["file_path"],
        }

    async def execute(self, **kwargs: Any) -> Any:
        file_path_str: str = kwargs["file_path"]
        start_line: int = kwargs.get("start_line", 1)
        end_line: int | None = kwargs.get("end_line")

        # ------------------------------------------------------------------
        # Path safety: resolve and check against allowed directories
        # ------------------------------------------------------------------
        try:
            resolved = Path(file_path_str).resolve()
        except (ValueError, OSError) as exc:
            return {"error": f"Invalid file path: {exc}"}

        if not any(str(resolved).startswith(base) for base in _ALLOWED_BASE_DIRS):
            return {
                "error": (
                    "Access denied. Only files within the cloned repository "
                    "workspace can be read."
                ),
            }

        if not resolved.exists():
            return {"error": f"File not found: {file_path_str}"}

        if not resolved.is_file():
            return {"error": f"Path is not a file: {file_path_str}"}

        # Check file size
        file_size = resolved.stat().st_size
        if file_size > _MAX_FILE_SIZE_BYTES:
            return {
                "error": (
                    f"File too large ({file_size:,} bytes). "
                    f"Maximum allowed: {_MAX_FILE_SIZE_BYTES:,} bytes."
                ),
            }

        logger.info(
            "Reading file: %s (lines %d-%s, size=%d)",
            resolved,
            start_line,
            end_line or "EOF",
            file_size,
        )

        # ------------------------------------------------------------------
        # Read file content
        # ------------------------------------------------------------------
        try:
            text = resolved.read_text(encoding="utf-8", errors="replace")
        except Exception as exc:
            return {"error": f"Failed to read file: {exc}"}

        lines = text.splitlines()
        total_lines = len(lines)

        # Apply line range
        start_idx = max(0, start_line - 1)
        end_idx = min(total_lines, end_line) if end_line else total_lines

        if end_idx > start_idx + _MAX_LINE_COUNT:
            end_idx = start_idx + _MAX_LINE_COUNT

        selected_lines = lines[start_idx:end_idx]

        # Detect file type from extension
        extension = resolved.suffix.lower()
        language_map = {
            ".py": "python",
            ".ts": "typescript",
            ".tsx": "tsx",
            ".js": "javascript",
            ".jsx": "jsx",
            ".java": "java",
            ".go": "go",
            ".rs": "rust",
            ".rb": "ruby",
            ".yml": "yaml",
            ".yaml": "yaml",
            ".json": "json",
            ".toml": "toml",
            ".md": "markdown",
            ".sql": "sql",
            ".sh": "bash",
            ".css": "css",
            ".html": "html",
        }
        language = language_map.get(extension, "text")

        return {
            "file_path": str(resolved),
            "language": language,
            "content": "\n".join(selected_lines),
            "start_line": start_idx + 1,
            "end_line": end_idx,
            "total_lines": total_lines,
            "file_size_bytes": file_size,
            "truncated": end_idx < total_lines,
        }
