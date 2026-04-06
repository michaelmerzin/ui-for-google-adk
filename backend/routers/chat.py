import json
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from db.database import get_db
from db.models import Message, Session as ChatSession
from db.models import User
from models.schemas import ChatRequest
from routers.deps import get_current_user

router = APIRouter(prefix="/chat", tags=["chat"])

SUPPORTED_MODELS = [
    "gpt-4o",
    "gpt-4-turbo",
    "gpt-3.5-turbo",
    "claude-3-5-sonnet-20241022",
    "gemini-1.5-pro",
    "gemini-2.0-flash",
    "llama-3-70b-instruct",
    "mistral-large-latest",
]


async def _get_session_or_404(session_id: str, user_id: int, db: AsyncSession) -> ChatSession:
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.user_id == user_id
        )
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


async def _load_history(session_id: str, db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at)
    )
    return [{"role": m.role, "content": m.content} for m in result.scalars().all()]


async def _save_messages(
    session: ChatSession,
    user_msg: str,
    assistant_msg: str,
    tool_name: str | None,
    db: AsyncSession,
) -> None:
    db.add(Message(session_id=session.id, role="user", content=user_msg))
    db.add(
        Message(
            session_id=session.id,
            role="assistant",
            content=assistant_msg,
            tool_name=tool_name,
        )
    )
    # Auto-title first exchange
    if session.title == "New Session":
        session.title = user_msg[:60] + ("…" if len(user_msg) > 60 else "")
    session.updated_at = datetime.now(timezone.utc)
    await db.commit()


@router.get("/models")
async def list_models(_: User = Depends(get_current_user)):
    return {"models": SUPPORTED_MODELS}


@router.post("/send")
async def send_message(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session_or_404(body.session_id, current_user.id, db)
    history = await _load_history(body.session_id, db)

    if body.stream:
        return StreamingResponse(
            _stream_response(body, session, history, current_user, db),
            media_type="text/event-stream",
        )

    content, tool_name = await _call_adk_or_litellm(body, history, current_user)
    await _save_messages(session, body.message, content, tool_name, db)
    return {"content": content, "tool_name": tool_name}


async def _stream_response(body, session, history, current_user, db):
    """Stream tokens from LiteLLM, saving on completion."""
    messages = _build_messages(history, body.message)
    full_content = []

    async with httpx.AsyncClient(timeout=120) as client:
        try:
            async with client.stream(
                "POST",
                f"{settings.LITELLM_BASE_URL}/v1/chat/completions",
                headers=_litellm_headers(),
                json={
                    "model": body.model,
                    "messages": messages,
                    "stream": True,
                    "max_tokens": 4096,
                },
            ) as resp:
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    chunk = line[6:]
                    if chunk == "[DONE]":
                        break
                    try:
                        delta = json.loads(chunk)["choices"][0]["delta"].get("content", "")
                        if delta:
                            full_content.append(delta)
                            yield f"data: {json.dumps({'delta': delta})}\n\n"
                    except Exception:
                        pass
        except httpx.ConnectError:
            error_msg = "⚠️ Cannot connect to LiteLLM. Is it running?"
            yield f"data: {json.dumps({'delta': error_msg})}\n\n"
            full_content.append(error_msg)

    assembled = "".join(full_content)
    await _save_messages(session, body.message, assembled, None, db)
    yield f"data: {json.dumps({'done': True})}\n\n"


async def _call_adk_or_litellm(
    body: ChatRequest, history: list[dict], current_user: User
) -> tuple[str, str | None]:
    """Try ADK first, fall back to LiteLLM directly."""
    # -- Try Google ADK --
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{settings.ADK_BASE_URL}/run",
                headers={"Content-Type": "application/json"},
                json={
                    "app_name": settings.ADK_AGENT_NAME,
                    "user_id": str(current_user.id),
                    "session_id": body.session_id,
                    "new_message": {"role": "user", "parts": [{"text": body.message}]},
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                content = ""
                tool_name = None
                for event in data if isinstance(data, list) else [data]:
                    parts = event.get("content", {}).get("parts", [])
                    for part in parts:
                        if "text" in part:
                            content += part["text"]
                        if "functionCall" in part:
                            tool_name = part["functionCall"].get("name")
                if content:
                    return content, tool_name
    except (httpx.ConnectError, httpx.TimeoutException):
        pass  # ADK not available — fall through to LiteLLM

    # -- Fall back to LiteLLM --
    messages = _build_messages(history, body.message)
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{settings.LITELLM_BASE_URL}/v1/chat/completions",
            headers=_litellm_headers(),
            json={"model": body.model, "messages": messages, "max_tokens": 4096},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"LiteLLM error: {resp.text[:200]}")
        data = resp.json()
        return data["choices"][0]["message"]["content"], None


def _build_messages(history: list[dict], new_message: str) -> list[dict]:
    return [
        {"role": "system", "content": "You are a helpful AI assistant powered by Google ADK and LiteLLM."},
        *history,
        {"role": "user", "content": new_message},
    ]


def _litellm_headers() -> dict:
    headers = {"Content-Type": "application/json"}
    if settings.LITELLM_API_KEY:
        headers["Authorization"] = f"Bearer {settings.LITELLM_API_KEY}"
    return headers
