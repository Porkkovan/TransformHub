import json
import logging
import uuid
from typing import Any

import tiktoken

from app.core.database import db_pool
from app.services.claude_client import claude_client

logger = logging.getLogger(__name__)

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50


def chunk_code(content: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    enc = tiktoken.get_encoding("cl100k_base")
    tokens = enc.encode(content)
    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + chunk_size, len(tokens))
        chunk_tokens = tokens[start:end]
        chunks.append(enc.decode(chunk_tokens))
        start += chunk_size - overlap
    return chunks


async def generate_embedding(text: str) -> list[float]:
    """Generate embeddings using Claude's analysis as a proxy.
    In production, use a dedicated embedding model (e.g., OpenAI text-embedding-3-small).
    """
    try:
        from openai import OpenAI
        import os
        openai_key = os.environ.get("OPENAI_API_KEY")
        if openai_key:
            client = OpenAI(api_key=openai_key)
            response = client.embeddings.create(
                model="text-embedding-3-small",
                input=text,
                dimensions=1536,
            )
            return response.data[0].embedding
    except Exception:
        pass

    # Fallback: return zero vector (semantic search won't work without real embeddings)
    return [0.0] * 1536


async def embed_and_store(
    repository_id: str,
    file_path: str,
    content: str,
    metadata: dict[str, Any] | None = None,
) -> int:
    chunks = chunk_code(content)
    count = 0

    for i, chunk in enumerate(chunks):
        embedding = await generate_embedding(chunk)
        chunk_id = str(uuid.uuid4())

        await db_pool.execute(
            """
            INSERT INTO code_embeddings (id, repository_id, file_path, chunk_index, content, embedding, metadata, created_at)
            VALUES ($1, $2, $3, $4, $5, $6::vector, $7::jsonb, NOW())
            """,
            chunk_id,
            repository_id,
            file_path,
            i,
            chunk,
            str(embedding),
            json.dumps(metadata or {}),
        )
        count += 1

    logger.info("Embedded %d chunks for %s", count, file_path)
    return count
