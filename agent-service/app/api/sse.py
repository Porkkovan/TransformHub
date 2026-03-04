import asyncio
import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.services.event_bus import event_bus

router = APIRouter(prefix="/agents", tags=["sse"])


@router.get("/stream/{execution_id}")
async def stream_agent_events(execution_id: str):
    async def event_generator():
        try:
            async for event in event_bus.subscribe(f"execution:{execution_id}"):
                data = json.dumps(event, default=str)
                yield f"event: {event.get('type', 'update')}\ndata: {data}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            yield "event: close\ndata: {}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
