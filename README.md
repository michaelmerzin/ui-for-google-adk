# ADK Studio

Production-ready chat UI for **Google ADK 1.25.1** + **LiteLLM 1.82.0**, built with **React (Vite) + FastAPI**.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| State | Zustand + TanStack Query |
| Backend | FastAPI + SQLAlchemy (async) |
| DB | SQLite (swap to Postgres in prod) |
| Auth | JWT (access + refresh tokens) + bcrypt |
| AI | Google ADK 1.25.1 → LiteLLM 1.82.0 fallback |

---

## Quick Start

### Option A — Docker Compose (recommended)

```bash
docker-compose up --build
```

- Frontend: http://localhost:5173  
- Backend API: http://localhost:8000  
- Swagger docs: http://localhost:8000/docs

### Option B — Local dev

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # edit as needed
uvicorn main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

---

## Default credentials

| Username | Password | Role |
|---|---|---|
| admin | admin123 | admin |

The admin user is seeded automatically on first boot. Change the password immediately via User Management.

---

## Architecture

```
adk-studio/
├── backend/
│   ├── main.py                # FastAPI app + CORS + lifespan
│   ├── core/
│   │   ├── config.py          # Pydantic Settings (.env)
│   │   └── security.py        # JWT + bcrypt
│   ├── db/
│   │   ├── database.py        # Async SQLAlchemy + DB seeder
│   │   └── models.py          # User, Session, Message ORM models
│   ├── models/schemas.py      # Pydantic request/response schemas
│   └── routers/
│       ├── auth.py            # POST /auth/login, /refresh, GET /me
│       ├── users.py           # Admin CRUD /users
│       ├── sessions.py        # /sessions + /sessions/{id}/messages
│       └── chat.py            # /chat/send (ADK → LiteLLM fallback + SSE)
│
└── frontend/
    └── src/
        ├── api/client.ts          # Axios + JWT refresh interceptor
        ├── store/
        │   ├── authStore.ts       # Zustand auth (persisted)
        │   └── chatStore.ts       # Zustand sessions + messages
        ├── hooks/useChat.ts       # Send + SSE streaming + session CRUD
        └── components/
            ├── Sidebar.tsx        # Session list + user menu
            ├── Topbar.tsx         # Session name + model selector
            ├── ChatArea.tsx       # Message thread + welcome state
            ├── MessageBubble.tsx  # Markdown + code block renderer
            ├── InputBar.tsx       # Textarea + streaming send
            ├── UserMgmtModal.tsx  # Admin: add/remove/role users
            └── ConfigModal.tsx    # ADK + LiteLLM runtime config
```

---

## API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | — | Get access + refresh tokens |
| POST | `/auth/refresh` | — | Rotate tokens |
| GET | `/auth/me` | ✓ | Current user info |
| GET | `/users/` | admin | List all users |
| POST | `/users/` | admin | Create user |
| PATCH | `/users/{id}` | admin | Update role / disable |
| DELETE | `/users/{id}` | admin | Remove user |
| GET | `/sessions/` | ✓ | List user's sessions |
| POST | `/sessions/` | ✓ | Create session |
| PATCH | `/sessions/{id}` | ✓ | Rename / change model |
| DELETE | `/sessions/{id}` | ✓ | Delete session |
| GET | `/sessions/{id}/messages` | ✓ | Load message history |
| POST | `/chat/send` | ✓ | Send message (stream=true for SSE) |
| GET | `/chat/models` | ✓ | List available models |

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and set:

```env
SECRET_KEY=           # openssl rand -hex 32
LITELLM_BASE_URL=     # http://localhost:4000
LITELLM_API_KEY=      # your LiteLLM proxy key
ADK_BASE_URL=         # http://localhost:8000 (adk web)
ADK_AGENT_NAME=       # root_agent
DATABASE_URL=         # sqlite+aiosqlite:///./adk_studio.db
FRONTEND_URL=         # http://localhost:5173
```

---

## Production checklist

- [ ] Set a strong `SECRET_KEY`
- [ ] Switch `DATABASE_URL` to PostgreSQL  
- [ ] Run behind a reverse proxy (nginx / Caddy) with TLS  
- [ ] Set `FRONTEND_URL` to your actual domain  
- [ ] Change the default admin password  
- [ ] Build frontend: `npm run build` and serve `dist/` statically  
