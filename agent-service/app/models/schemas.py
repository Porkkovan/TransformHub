from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class AgentExecuteRequest(BaseModel):
    agent_type: str = Field(..., description="Type of agent: discovery, lean_vsm, risk_compliance")
    repository_id: Optional[str] = None
    execution_id: Optional[str] = None  # pre-created execution ID from the caller (Next.js)
    input_data: dict[str, Any] = Field(default_factory=dict)


class AgentExecuteResponse(BaseModel):
    execution_id: str
    status: str
    message: str


class AgentStatusResponse(BaseModel):
    execution_id: str
    agent_type: str
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


class AgentResultsResponse(BaseModel):
    execution_id: str
    agent_type: str
    status: str
    output: Optional[dict[str, Any]] = None
    error_message: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
