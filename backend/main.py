import asyncio
import time
from contextlib import asynccontextmanager
from typing import Any

import httpx

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from db.database import init_db
from routers import auth, chat, sessions, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="ADK Studio API",
    version="1.0.0",
    description="Google ADK 1.25.1 + LiteLLM 1.82.0 chat backend",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(sessions.router)
app.include_router(chat.router)


async def _probe_service(base_url: str, include_health_path: bool = True) -> dict[str, Any]:
    if not base_url:
        return {
            "configured": False,
            "reachable": False,
            "healthy": False,
            "status_code": None,
            "latency_ms": None,
            "checked_url": None,
            "error": "not configured",
        }

    base = base_url.rstrip("/")
    candidates = [f"{base}/health", base] if include_health_path else [base]
    last_error = "unreachable"

    async with httpx.AsyncClient(timeout=2.5, follow_redirects=True) as client:
        for url in candidates:
            started_at = time.perf_counter()
            try:
                resp = await client.get(url)
                latency_ms = int((time.perf_counter() - started_at) * 1000)
                return {
                    "configured": True,
                    "reachable": True,
                    "healthy": resp.status_code < 500,
                    "status_code": resp.status_code,
                    "latency_ms": latency_ms,
                    "checked_url": url,
                    "error": None,
                }
            except httpx.HTTPError as exc:
                last_error = str(exc)

    return {
        "configured": True,
        "reachable": False,
        "healthy": False,
        "status_code": None,
        "latency_ms": None,
        "checked_url": candidates[0],
        "error": last_error,
    }


@app.get("/health")
async def health():
    adk, litellm = await asyncio.gather(
        _probe_service(settings.ADK_BASE_URL, include_health_path=False),
        _probe_service(settings.LITELLM_BASE_URL, include_health_path=True),
    )

    healthy_count = sum(int(dep["healthy"]) for dep in (adk, litellm))
    if healthy_count == 2:
        status = "ok"
    elif healthy_count == 1:
        status = "degraded"
    else:
        status = "down"

    return {
        "status": status,
        "backend": {"healthy": True, "version": app.version},
        "adk": adk,
        "litellm": litellm,
        "adk_version": "1.25.1",
        "litellm_version": "1.82.0",
    }
