import json
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.database import db_pool

router = APIRouter(prefix="/feedback", tags=["feedback"])


class FeedbackRequest(BaseModel):
    execution_id: str
    user_id: str
    rating: int  # 1-5
    corrections: Optional[dict] = None
    comment: Optional[str] = None


@router.post("")
async def submit_feedback(request: FeedbackRequest):
    if not 1 <= request.rating <= 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    feedback_id = str(uuid.uuid4())
    await db_pool.execute(
        """
        INSERT INTO agent_feedbacks (id, execution_id, user_id, rating, corrections, comment, created_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())
        """,
        feedback_id,
        request.execution_id,
        request.user_id,
        request.rating,
        json.dumps(request.corrections) if request.corrections else None,
        request.comment,
    )
    return {"id": feedback_id, "status": "submitted"}


@router.get("")
async def list_feedback(execution_id: Optional[str] = None, limit: int = 50):
    if execution_id:
        rows = await db_pool.fetch(
            """
            SELECT id, execution_id, user_id, rating, corrections, comment, created_at
            FROM agent_feedbacks
            WHERE execution_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            """,
            execution_id,
            limit,
        )
    else:
        rows = await db_pool.fetch(
            """
            SELECT id, execution_id, user_id, rating, corrections, comment, created_at
            FROM agent_feedbacks
            ORDER BY created_at DESC
            LIMIT $1
            """,
            limit,
        )
    return [dict(r) for r in rows]


@router.get("/{feedback_id}")
async def get_feedback(feedback_id: str):
    row = await db_pool.fetchrow(
        "SELECT * FROM agent_feedbacks WHERE id = $1",
        feedback_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return dict(row)
