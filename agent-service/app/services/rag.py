import logging
from typing import Any

from app.core.database import db_pool
from app.services.embeddings import generate_embedding

logger = logging.getLogger(__name__)


class RAGService:
    async def search(
        self,
        query: str,
        repository_id: str | None = None,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        query_embedding = await generate_embedding(query)

        if repository_id:
            rows = await db_pool.fetch(
                """
                SELECT id, file_path, chunk_index, content, metadata,
                    1 - (embedding <=> $1::vector) AS similarity
                FROM code_embeddings
                WHERE repository_id = $2
                ORDER BY embedding <=> $1::vector
                LIMIT $3
                """,
                str(query_embedding),
                repository_id,
                limit,
            )
        else:
            rows = await db_pool.fetch(
                """
                SELECT id, file_path, chunk_index, content, metadata,
                    1 - (embedding <=> $1::vector) AS similarity
                FROM code_embeddings
                ORDER BY embedding <=> $1::vector
                LIMIT $2
                """,
                str(query_embedding),
                limit,
            )

        return [
            {
                "id": r["id"],
                "file_path": r["file_path"],
                "chunk_index": r["chunk_index"],
                "content": r["content"],
                "similarity": float(r["similarity"]) if r["similarity"] else 0,
            }
            for r in rows
        ]

    async def retrieve_context(
        self,
        query: str,
        repository_id: str | None = None,
        max_tokens: int = 2000,
    ) -> str:
        results = await self.search(query, repository_id, limit=5)
        if not results:
            return ""

        context_parts = []
        for r in results:
            context_parts.append(f"--- {r['file_path']} (chunk {r['chunk_index']}) ---\n{r['content']}")

        return "\n\n".join(context_parts)


rag_service = RAGService()
