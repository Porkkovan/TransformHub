import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import db_pool
from app.core.redis import redis_pool
from app.core.logging import setup_logging
from app.core.tracing import setup_tracing
from app.core.config import settings
from app.core.auth import verify_api_key
from app.api import agents_router, health_router
from app.api.sse import router as sse_router
from app.api.metrics import router as metrics_router
from app.api.search import router as search_router
from app.api.chat import router as chat_router
from app.api.pipeline import router as pipeline_router
from app.api.approvals import router as approvals_router
from app.api.feedback import router as feedback_router
from app.api.notifications import router as notifications_router

load_dotenv()

setup_logging(settings.log_level)
setup_tracing()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db_pool.connect()
    await redis_pool.connect()
    yield
    await redis_pool.disconnect()
    await db_pool.disconnect()


app = FastAPI(
    title="TransformHub Agent Service",
    version="2.0.0",
    lifespan=lifespan,
)

allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Api-Key"],
)

# Health endpoint is public (no API key required)
app.include_router(health_router, prefix="/api/v1")

# All other routers require API key authentication
_auth_deps = [Depends(verify_api_key)]
app.include_router(agents_router, prefix="/api/v1", dependencies=_auth_deps)
app.include_router(sse_router, prefix="/api/v1", dependencies=_auth_deps)
app.include_router(metrics_router, prefix="/api/v1", dependencies=_auth_deps)
app.include_router(search_router, prefix="/api/v1", dependencies=_auth_deps)
app.include_router(chat_router, prefix="/api/v1", dependencies=_auth_deps)
app.include_router(pipeline_router, prefix="/api/v1", dependencies=_auth_deps)
app.include_router(approvals_router, prefix="/api/v1", dependencies=_auth_deps)
app.include_router(feedback_router, prefix="/api/v1", dependencies=_auth_deps)
app.include_router(notifications_router, prefix="/api/v1", dependencies=_auth_deps)
