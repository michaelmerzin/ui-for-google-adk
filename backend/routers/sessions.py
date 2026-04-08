from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import Message, Session as ChatSession
from db.models import User
from models.schemas import MessageOut, SessionCreate, SessionOut, SessionUpdate
from routers.deps import get_current_user

router = APIRouter(prefix="/sessions", tags=["sessions"])


async def _session_out(session: ChatSession, db: AsyncSession) -> SessionOut:
    result = await db.execute(
        select(func.count()).where(Message.session_id == session.id)
    )
    count = result.scalar() or 0
    return SessionOut(
        id=session.id,
        title=session.title,
        model=session.model,
        user_id=session.user_id,
        created_at=session.created_at,
        updated_at=session.updated_at,
        message_count=count,
    )


@router.get("/", response_model=list[SessionOut])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
    )
    sessions = result.scalars().all()
    return [await _session_out(s, db) for s in sessions]


@router.post("/", response_model=SessionOut, status_code=201)
async def create_session(
    body: SessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = ChatSession(title=body.title, model=body.model, user_id=current_user.id)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return await _session_out(session, db)


@router.patch("/{session_id}", response_model=SessionOut)
async def update_session(
    session_id: str,
    body: SessionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.user_id == current_user.id
        )
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if body.title is not None:
        session.title = body.title
    if body.model is not None:
        session.model = body.model
    session.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(session)
    return await _session_out(session, db)


@router.delete("/{session_id}", status_code=204)
async def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.user_id == current_user.id
        )
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()


@router.get("/{session_id}/messages", response_model=list[MessageOut])
async def get_messages(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.user_id == current_user.id
        )
    )
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Session not found")

    msgs = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at)
    )
    return msgs.scalars().all()


# ── ADK state proxy ───────────────────────────────────────────────────────────

@router.get("/{session_id}/adk-state")
async def get_adk_state(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch live session state + events from the ADK server."""
    import httpx
    from core.config import settings

    # Verify session belongs to user
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Session not found")

    empty = {"state": {}, "events": [], "memory": [], "last_update": 0}

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"{settings.ADK_BASE_URL}/apps/{settings.ADK_AGENT_NAME}"
                f"/users/{current_user.id}/sessions/{session_id}",
            )
            if resp.status_code != 200:
                return empty

            data = resp.json()
            raw_state = data.get("state", {})
            raw_events = data.get("events", [])

            # Parse events into our frontend format
            parsed_events = []
            for i, ev in enumerate(raw_events):
                content = ev.get("content") or {}
                author = ev.get("author", "unknown")
                parts = content.get("parts", [])
                actions = ev.get("actions") or {}
                state_delta = actions.get("state_delta") or {}
                ts = ev.get("timestamp", 0)

                # Classify event
                has_text = any("text" in p for p in parts)
                has_fc = any("functionCall" in p for p in parts)
                has_fr = any("functionResponse" in p for p in parts)
                has_sd = bool(state_delta)

                if author == "user":
                    text = next((p["text"] for p in parts if "text" in p), "")
                    parsed_events.append({
                        "id": ev.get("id", str(i)),
                        "type": "user",
                        "label": "user message",
                        "detail": text[:60] + ("..." if len(text) > 60 else ""),
                        "timestamp": int(ts * 1000),
                    })
                elif has_fc:
                    for p in parts:
                        if "functionCall" in p:
                            fc = p["functionCall"]
                            args = fc.get("args", {})
                            arg_str = ", ".join(f"{k}={repr(v)}" for k, v in list(args.items())[:2])
                            parsed_events.append({
                                "id": ev.get("id", str(i)) + "_fc",
                                "type": "tool_call",
                                "label": f"{fc.get('name', 'tool')}({arg_str})",
                                "detail": str(args)[:80] if args else None,
                                "timestamp": int(ts * 1000),
                            })
                elif has_fr:
                    for p in parts:
                        if "functionResponse" in p:
                            fr = p["functionResponse"]
                            resp_data = fr.get("response", {})
                            status = resp_data.get("status", "done") if isinstance(resp_data, dict) else "done"
                            parsed_events.append({
                                "id": ev.get("id", str(i)) + "_fr",
                                "type": "tool_result",
                                "label": f"{fr.get('name', 'tool')} → {status}",
                                "detail": str(resp_data)[:80] if resp_data else None,
                                "timestamp": int(ts * 1000),
                            })
                elif has_sd:
                    keys = list(state_delta.keys())
                    parsed_events.append({
                        "id": ev.get("id", str(i)) + "_sd",
                        "type": "state_delta",
                        "label": "state updated",
                        "detail": ", ".join(keys[:4]) + ("..." if len(keys) > 4 else ""),
                        "timestamp": int(ts * 1000),
                    })
                elif has_text and author != "user":
                    text = next((p["text"] for p in parts if "text" in p), "")
                    is_final = ev.get("partial") is False or i == len(raw_events) - 1
                    parsed_events.append({
                        "id": ev.get("id", str(i)),
                        "type": "agent",
                        "label": "final response" if is_final else "agent thinking",
                        "detail": text[:60] + ("..." if len(text) > 60 else ""),
                        "timestamp": int(ts * 1000),
                    })

            return {
                "state": raw_state,
                "events": parsed_events,
                "memory": [],
                "last_update": int(raw_events[-1]["timestamp"] * 1000) if raw_events else 0,
            }

    except Exception:
        return empty