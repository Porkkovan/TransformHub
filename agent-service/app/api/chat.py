import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from app.services.chat_service import chat_service

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    conversation_id: str
    message: str
    repository_id: Optional[str] = None


class CreateConversationRequest(BaseModel):
    organization_id: Optional[str] = None
    user_id: Optional[str] = None
    title: Optional[str] = None


@router.post("/conversations")
async def create_conversation(request: CreateConversationRequest):
    conv_id = await chat_service.create_conversation(
        organization_id=request.organization_id,
        user_id=request.user_id,
        title=request.title,
    )
    return {"id": conv_id}


@router.get("/conversations")
async def list_conversations(organization_id: Optional[str] = None):
    conversations = await chat_service.list_conversations(organization_id)
    return conversations


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(conversation_id: str):
    messages = await chat_service.get_messages(conversation_id)
    return messages


@router.post("/send")
async def send_message(request: ChatRequest):
    response = await chat_service.chat_with_context(
        conversation_id=request.conversation_id,
        user_message=request.message,
        repository_id=request.repository_id,
    )
    return {"response": response}


@router.post("/stream")
async def stream_chat(request: ChatRequest):
    async def event_generator():
        response = await chat_service.chat_with_context(
            conversation_id=request.conversation_id,
            user_message=request.message,
            repository_id=request.repository_id,
        )
        # Stream the response in chunks
        words = response.split(" ")
        buffer = ""
        for i, word in enumerate(words):
            buffer += word + " "
            if len(buffer) > 20 or i == len(words) - 1:
                data = json.dumps({"content": buffer, "done": i == len(words) - 1})
                yield f"data: {data}\n\n"
                buffer = ""

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )
