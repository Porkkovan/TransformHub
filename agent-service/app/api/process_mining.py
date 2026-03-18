"""
P4: Process mining API endpoint.

POST /api/v1/process-mining
Body: {
  event_log: str (CSV text) or list of event dicts,
  vsm_step_names: list[str] (optional — for VSM mapping),
  top_n_bottlenecks: int (optional, default 5)
}
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Union

from app.services.process_mining import process_mining_service

router = APIRouter(prefix="/process-mining", tags=["process-mining"])


class ProcessMiningRequest(BaseModel):
    event_log: Union[str, list]
    vsm_step_names: Optional[list[str]] = None
    top_n_bottlenecks: int = 5


@router.post("")
async def run_process_mining(req: ProcessMiningRequest):
    """
    Analyze an event log and return process mining insights.

    Accepts CSV text or a list of event dicts in format:
      {case_id, activity, timestamp, resource (optional)}
    """
    try:
        result = process_mining_service.analyze(
            req.event_log,
            vsm_step_names=req.vsm_step_names,
            top_n_bottlenecks=req.top_n_bottlenecks,
        )
        if "error" in result:
            raise HTTPException(status_code=422, detail=result["error"])
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Process mining failed: {e}")
