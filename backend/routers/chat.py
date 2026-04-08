import json
import time
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
    "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo",
    "claude-3-5-sonnet-20241022",
    "gemini-1.5-pro", "gemini-2.0-flash",
    "llama-3-70b-instruct", "mistral-large-latest",
]


async def _get_session_or_404(session_id: str, user_id: int, db: AsyncSession) -> ChatSession:
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user_id)
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


async def _load_history(session_id: str, db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(Message).where(Message.session_id == session_id).order_by(Message.created_at)
    )
    return [{"role": m.role, "content": m.content} for m in result.scalars().all()]


async def _save_messages(session, user_msg, assistant_msg, tool_name, db):
    db.add(Message(session_id=session.id, role="user", content=user_msg))
    db.add(Message(session_id=session.id, role="assistant", content=assistant_msg, tool_name=tool_name))
    if session.title == "New Session":
        session.title = user_msg[:60] + ("..." if len(user_msg) > 60 else "")
    session.updated_at = datetime.now(timezone.utc)
    await db.commit()


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


async def _ensure_adk_session(client: httpx.AsyncClient, session_id: str, user_id: str):
    """
    ADK requires a session to exist before /run_sse can be called.
    GET first — if 404, create it with POST /apps/{app}/users/{user}/sessions/{id}
    ADK docs: https://google.github.io/adk-docs/runtime/api-server/
    """
    base = f"{settings.ADK_BASE_URL}/apps/{settings.ADK_AGENT_NAME}/users/{user_id}/sessions/{session_id}"

    try:
        resp = await client.get(base)
        if resp.status_code == 200:
            return  # session already exists in ADK
    except Exception:
        pass

    # Session doesn't exist — create it
    # Body: optional initial state dict
    try:
        await client.post(base, json={"state": {}}, headers={"Content-Type": "application/json"})
    except Exception as e:
        print(f"Failed to create ADK session: {e}")


def _parse_adk_event(event: dict) -> tuple[str, str | None, dict | None]:
    """
    Returns: (text, tool_name, step_or_None)
    """
    text = ""
    tool_name = None
    step = None

    content = event.get("content") or {}
    role = content.get("role", "")
    parts = content.get("parts", [])

    for part in parts:
        if "text" in part and role == "model":
            text += part["text"]

        if "functionCall" in part:
            fc = part["functionCall"]
            name = fc.get("name", "tool")
            args = fc.get("args", {})
            tool_name = name
            step = {
                "type": "tool_call",
                "label": f"Calling: {name}()",
                "detail": json.dumps(args, indent=2) if args else None,
            }

        if "functionResponse" in part:
            fr = part["functionResponse"]
            name = fr.get("name", "tool")
            response = fr.get("response", {})
            summary = _summarise_response(response)
            step = {
                "type": "tool_result",
                "label": f"{name} → {summary}",
                "detail": json.dumps(response, indent=2) if response else None,
            }

    thought = event.get("thought") or event.get("reasoning")
    if thought:
        step = {
            "type": "thinking",
            "label": "Thinking...",
            "detail": str(thought)[:500] if len(str(thought)) > 80 else None,
        }

    transfer = event.get("agentTransfer") or event.get("agent_transfer")
    if transfer:
        step = {
            "type": "agent_transfer",
            "label": f"Handing off to: {transfer.get('target', 'sub-agent')}",
            "detail": None,
        }

    return text, tool_name, step


def _summarise_response(response) -> str:
    if not response:
        return "done"
    if isinstance(response, list):
        return f"{len(response)} item{'s' if len(response) != 1 else ''}"
    if isinstance(response, dict):
        if "rows" in response:
            return f"{len(response['rows'])} rows"
        if "results" in response:
            return f"{len(response['results'])} results"
        if "error" in response:
            return f"error: {str(response['error'])[:40]}"
        return f"{len(response)} fields"
    return str(response)[:60]


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
            _stream(body, session, history, current_user, db),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    content, tool_name = await _call_adk_or_litellm(body, current_user)
    await _save_messages(session, body.message, content, tool_name, db)
    return {"content": content, "tool_name": tool_name}


async def _stream(body, session, history, current_user, db):
    full_content = []
    tool_name = None
    adk_ok = False

    adk_payload = {
        "app_name": settings.ADK_AGENT_NAME,
        "user_id": str(current_user.id),
        "session_id": body.session_id,
        "new_message": {
            "role": "user",
            "parts": [{"text": body.message}],
        },
    }

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            # ── Ensure ADK session exists before running ──
            await _ensure_adk_session(client, body.session_id, str(current_user.id))

            async with client.stream(
                "POST",
                f"{settings.ADK_BASE_URL}/run_sse",
                headers={"Content-Type": "application/json"},
                json=adk_payload,
            ) as resp:
                if resp.status_code == 200:
                    adk_ok = True
                    t_start = time.monotonic()

                    async for raw_line in resp.aiter_lines():
                        if not raw_line.startswith("data:"):
                            continue
                        data_str = raw_line[5:].strip()
                        if not data_str or data_str == "[DONE]":
                            break

                        try:
                            event = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue

                        text, fn, step = _parse_adk_event(event)

                        if step:
                            duration_ms = int((time.monotonic() - t_start) * 1000)
                            step["durationMs"] = duration_ms
                            yield _sse({"step": step})
                            t_start = time.monotonic()

                        if fn:
                            tool_name = fn

                        if text:
                            full_content.append(text)
                            yield _sse({"delta": text})
                else:
                    # Log non-200 for debugging
                    body_text = await resp.aread()
                    print(f"ADK /run_sse returned {resp.status_code}: {body_text[:200]}")

    except (httpx.ConnectError, httpx.TimeoutException) as e:
        print(f"ADK connection failed: {e}")

    # ── LiteLLM fallback ──
    if not adk_ok:
        messages = _build_messages(history, body.message)
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream(
                    "POST",
                    f"{settings.LITELLM_BASE_URL}/v1/chat/completions",
                    headers=_litellm_headers(),
                    json={"model": body.model, "messages": messages, "stream": True, "max_tokens": 4096},
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
                                yield _sse({"delta": delta})
                        except Exception:
                            pass
        except httpx.ConnectError:
            err = "Cannot connect to ADK or LiteLLM. Check your configuration."
            full_content.append(err)
            yield _sse({"delta": err})

    assembled = "".join(full_content)
    await _save_messages(session, body.message, assembled, tool_name, db)
    yield _sse({"done": True})


async def _call_adk_or_litellm(body, current_user) -> tuple[str, str | None]:
    adk_payload = {
        "app_name": settings.ADK_AGENT_NAME,
        "user_id": str(current_user.id),
        "session_id": body.session_id,
        "new_message": {
            "role": "user",
            "parts": [{"text": body.message}],
        },
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            await _ensure_adk_session(client, body.session_id, str(current_user.id))

            async with client.stream(
                "POST",
                f"{settings.ADK_BASE_URL}/run_sse",
                headers={"Content-Type": "application/json"},
                json=adk_payload,
            ) as resp:
                if resp.status_code == 200:
                    parts_text = []
                    tool_name = None
                    async for raw_line in resp.aiter_lines():
                        if not raw_line.startswith("data:"):
                            continue
                        data_str = raw_line[5:].strip()
                        if not data_str or data_str == "[DONE]":
                            break
                        try:
                            event = json.loads(data_str)
                            text, fn, _ = _parse_adk_event(event)
                            if fn:
                                tool_name = fn
                            if text:
                                parts_text.append(text)
                        except json.JSONDecodeError:
                            pass
                    content = "".join(parts_text)
                    if content:
                        return content, tool_name
    except (httpx.ConnectError, httpx.TimeoutException):
        pass

    # LiteLLM fallback
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{settings.LITELLM_BASE_URL}/v1/chat/completions",
            headers=_litellm_headers(),
            json={
                "model": body.model,
                "messages": [{"role": "user", "content": body.message}],
                "max_tokens": 4096,
            },
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"LiteLLM error: {resp.text[:200]}")
        data = resp.json()
        return data["choices"][0]["message"]["content"], None


def _build_messages(history, new_message):
    return [
        {"role": "system", "content": "You are a helpful AI assistant powered by Google ADK and LiteLLM."},
        *history,
        {"role": "user", "content": new_message},
    ]


def _litellm_headers():
    headers = {"Content-Type": "application/json"}
    if settings.LITELLM_API_KEY:
        headers["Authorization"] = f"Bearer {settings.LITELLM_API_KEY}"
    return headers