import json
import logging
import uuid
from typing import Any, AsyncIterator

from app.core.database import db_pool
from app.services.claude_client import claude_client
from app.services.rag import rag_service

logger = logging.getLogger(__name__)


class ChatService:
    async def create_conversation(
        self,
        organization_id: str | None = None,
        user_id: str | None = None,
        title: str | None = None,
    ) -> str:
        conv_id = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO chat_conversations (id, title, organization_id, user_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            """,
            conv_id,
            title or "New Conversation",
            organization_id,
            user_id,
        )
        return conv_id

    async def list_conversations(
        self, organization_id: str | None = None, user_id: str | None = None
    ) -> list[dict]:
        if organization_id:
            rows = await db_pool.fetch(
                """
                SELECT id, title, created_at, updated_at
                FROM chat_conversations
                WHERE organization_id = $1
                ORDER BY updated_at DESC
                LIMIT 50
                """,
                organization_id,
            )
        else:
            rows = await db_pool.fetch(
                "SELECT id, title, created_at, updated_at FROM chat_conversations ORDER BY updated_at DESC LIMIT 50"
            )
        return [dict(r) for r in rows]

    async def get_messages(self, conversation_id: str) -> list[dict]:
        rows = await db_pool.fetch(
            """
            SELECT id, role, content, metadata, created_at
            FROM chat_messages
            WHERE conversation_id = $1
            ORDER BY created_at ASC
            """,
            conversation_id,
        )
        return [dict(r) for r in rows]

    async def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        metadata: dict | None = None,
    ) -> str:
        msg_id = str(uuid.uuid4())
        await db_pool.execute(
            """
            INSERT INTO chat_messages (id, conversation_id, role, content, metadata, created_at)
            VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
            """,
            msg_id,
            conversation_id,
            role,
            content,
            json.dumps(metadata or {}),
        )
        await db_pool.execute(
            "UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1",
            conversation_id,
        )
        return msg_id

    async def chat_with_context(
        self,
        conversation_id: str,
        user_message: str,
        repository_id: str | None = None,
    ) -> str:
        # Store user message
        await self.add_message(conversation_id, "user", user_message)

        # Get RAG context
        rag_context = await rag_service.retrieve_context(user_message, repository_id)

        # Get conversation history
        messages = await self.get_messages(conversation_id)
        history = [{"role": m["role"], "content": m["content"]} for m in messages[-10:]]

        # Build system prompt with context
        system = "You are TransformHub AI assistant, an expert in enterprise digital transformation."
        if rag_context:
            system += f"\n\nRelevant code context:\n{rag_context}"

        prompt = "\n".join(
            [f"{m['role'].upper()}: {m['content']}" for m in history]
        )

        response = await claude_client.analyze(
            prompt=prompt,
            system=system,
            max_tokens=2048,
        )

        # Store assistant response
        await self.add_message(conversation_id, "assistant", response)
        return response


chat_service = ChatService()
