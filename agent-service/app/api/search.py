from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from app.services.rag import rag_service

router = APIRouter(tags=["search"])


class SearchRequest(BaseModel):
    query: str
    repository_id: Optional[str] = None
    limit: int = 5


@router.post("/search/code")
async def search_code(request: SearchRequest):
    results = await rag_service.search(
        query=request.query,
        repository_id=request.repository_id,
        limit=request.limit,
    )
    return {"results": results, "count": len(results)}
