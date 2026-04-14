# ADK Studio

Production-ready chat UI for **Google ADK 1.25.1** with **LiteLLM 1.82.0** fallback, built with **React + Vite + FastAPI**.

This project is aimed at an agent-first UX rather than a plain chatbot shell. The UI is designed to make tool use, session state, model switching, and multi-step execution visible to the user.

## What Makes This Version Better

- Session-first workflow: existing sessions auto-load, titles can be renamed inline, and each session keeps its own model.
- Agent visibility: assistant steps stay attached to each reply, and the top bar surfaces tool-run and handoff counts.
- Better prompting flow: richer onboarding prompts, reusable last prompt, and quick actions that can either insert or send.
- Safer day-to-day use: session deletion now asks for confirmation.
- More reliable streaming: SSE parsing now handles chunk-split events correctly instead of depending on neat line boundaries.
- Cleaner interaction polish: copy/reuse actions on messages, clearer status states, and UI text cleanup.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| State | Zustand + TanStack Query |
| Backend | FastAPI + SQLAlchemy (async) |
| DB | SQLite by default |
| Auth | JWT access/refresh tokens + bcrypt |
| AI Runtime | Google ADK 1.25.1 with LiteLLM fallback |

## Quick Start

### Option A: Docker Compose

```bash
docker-compose up --build
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`

### Option B: Local Development

Backend:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

## Default Credentials

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | `admin` |

The admin user is seeded automatically on first boot. Change the password immediately from User Management.

## Core UX

### Main workspace

- `Sidebar`: sessions, current user, admin actions, destructive-session guard
- `Topbar`: inline rename, model selector, live agent status, state inspector toggle
- `ChatArea`: richer welcome state, quick-start prompts, message thread, session summary
- `InputBar`: streaming send, prompt reuse, token estimate, quick-prompt insertion

### Agent transparency

- `AgentSteps`: shows tool calls, results, reasoning steps, and transfers per assistant reply
- `StateInspector`: shows ADK-backed session state, events, and memory tabs
- `ResponseRenderer`: renders text, code, tables, lists, JSON, and coordinate-driven maps

## Project Structure

```text
ui-for-google-adk/
|-- backend/
|   |-- main.py
|   |-- core/
|   |   |-- config.py
|   |   `-- security.py
|   |-- db/
|   |   |-- database.py
|   |   `-- models.py
|   |-- models/
|   |   `-- schemas.py
|   `-- routers/
|       |-- auth.py
|       |-- chat.py
|       |-- deps.py
|       |-- sessions.py
|       `-- users.py
|-- frontend/
|   |-- src/
|   |   |-- api/client.ts
|   |   |-- hooks/useChat.ts
|   |   |-- pages/
|   |   |-- store/
|   |   `-- components/
|   `-- package.json
`-- adk_agent/
```

## Key API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/login` | no | Get access + refresh tokens |
| `POST` | `/auth/refresh` | no | Rotate tokens |
| `GET` | `/auth/me` | yes | Current user |
| `GET` | `/users/` | admin | List users |
| `POST` | `/users/` | admin | Create user |
| `PATCH` | `/users/{id}` | admin | Update role, status, or password |
| `DELETE` | `/users/{id}` | admin | Remove user |
| `GET` | `/sessions/` | yes | List sessions |
| `POST` | `/sessions/` | yes | Create session |
| `PATCH` | `/sessions/{id}` | yes | Rename session or change model |
| `DELETE` | `/sessions/{id}` | yes | Delete session |
| `GET` | `/sessions/{id}/messages` | yes | Load message history |
| `GET` | `/sessions/{id}/adk-state` | yes | Proxy ADK state/events for inspector |
| `POST` | `/chat/send` | yes | Send message, optionally stream via SSE |
| `GET` | `/chat/models` | yes | List available models |

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and set:

```env
SECRET_KEY=
LITELLM_BASE_URL=
LITELLM_API_KEY=
ADK_BASE_URL=
ADK_AGENT_NAME=
DATABASE_URL=sqlite+aiosqlite:///./adk_studio.db
FRONTEND_URL=http://localhost:5173
```

Typical local values:

- `LITELLM_BASE_URL=http://localhost:4000`
- `ADK_BASE_URL=http://localhost:8001`
- `ADK_AGENT_NAME=root_agent`

## Verification

Frontend type-check:

```bash
cd frontend
npx tsc --noEmit
```

## Production Checklist

- Set a strong `SECRET_KEY`
- Move `DATABASE_URL` to PostgreSQL
- Put the backend behind TLS and a reverse proxy
- Set `FRONTEND_URL` to the real domain
- Change the default admin password
- Build and serve the frontend statically
