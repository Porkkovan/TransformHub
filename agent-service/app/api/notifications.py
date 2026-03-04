import json
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.database import db_pool

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationConfigRequest(BaseModel):
    organization_id: str
    channel: str  # "email", "slack", "webhook"
    config: dict  # channel-specific config (e.g. webhook_url, email_to, slack_channel)
    enabled: bool = True


@router.post("/config")
async def create_notification_config(request: NotificationConfigRequest):
    config_id = str(uuid.uuid4())
    await db_pool.execute(
        """
        INSERT INTO notification_configs (id, organization_id, channel, config, enabled, created_at, updated_at)
        VALUES ($1, $2, $3, $4::jsonb, $5, NOW(), NOW())
        """,
        config_id,
        request.organization_id,
        request.channel,
        json.dumps(request.config),
        request.enabled,
    )
    return {"id": config_id, "status": "created"}


@router.get("/config")
async def list_notification_configs(organization_id: Optional[str] = None):
    if organization_id:
        rows = await db_pool.fetch(
            """
            SELECT id, organization_id, channel, config, enabled, created_at
            FROM notification_configs
            WHERE organization_id = $1
            ORDER BY created_at DESC
            """,
            organization_id,
        )
    else:
        rows = await db_pool.fetch(
            "SELECT id, organization_id, channel, config, enabled, created_at FROM notification_configs ORDER BY created_at DESC"
        )
    return [dict(r) for r in rows]


@router.put("/config/{config_id}")
async def update_notification_config(config_id: str, request: NotificationConfigRequest):
    result = await db_pool.execute(
        """
        UPDATE notification_configs
        SET channel = $2, config = $3::jsonb, enabled = $4, updated_at = NOW()
        WHERE id = $1
        """,
        config_id,
        request.channel,
        json.dumps(request.config),
        request.enabled,
    )
    if "UPDATE 0" in str(result):
        raise HTTPException(status_code=404, detail="Config not found")
    return {"status": "updated"}


@router.delete("/config/{config_id}")
async def delete_notification_config(config_id: str):
    result = await db_pool.execute(
        "DELETE FROM notification_configs WHERE id = $1",
        config_id,
    )
    if "DELETE 0" in str(result):
        raise HTTPException(status_code=404, detail="Config not found")
    return {"status": "deleted"}


@router.get("/log")
async def list_notification_logs(limit: int = 50):
    rows = await db_pool.fetch(
        """
        SELECT id, channel, subject, body, status, error, created_at
        FROM notification_logs
        ORDER BY created_at DESC
        LIMIT $1
        """,
        limit,
    )
    return [dict(r) for r in rows]
