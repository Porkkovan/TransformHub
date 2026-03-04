"""
API key authentication for the agent service.

Provides a FastAPI dependency that validates the X-Api-Key header
against the configured api_key in settings.
"""

from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader

from app.core.config import settings

api_key_header = APIKeyHeader(name="X-Api-Key", auto_error=False)


async def verify_api_key(api_key: str | None = Security(api_key_header)) -> str:
    """
    FastAPI dependency that checks the X-Api-Key header against settings.api_key.

    If settings.api_key is empty (not configured), authentication is bypassed
    to allow development without requiring a key.

    Returns the validated API key string.
    Raises HTTPException 401 if the key is missing or invalid.
    """
    # If no API key is configured, skip authentication (development mode)
    if not settings.api_key:
        return ""

    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="Missing API key. Provide X-Api-Key header.",
        )

    if api_key != settings.api_key:
        raise HTTPException(
            status_code=401,
            detail="Invalid API key.",
        )

    return api_key
