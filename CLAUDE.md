# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Backend** (from repo root): `poetry run pytest`, `poetry run ruff check server/`, `poetry run ruff format server/`
**Frontend** (from `frontend/`): `bun dev`, `bun run build`, `bun run lint`, `bun run lint-fix`
**Regenerate API client** (after any endpoint change): `cd frontend && bun run generate-client`

Tests are colocated: `model.py` -> `model_test.py`. Run one with `poetry run pytest server/tasks/model_test.py`.

## Stack

- **Backend**: FastAPI, Python 3.12, Celery 5.4, Pydantic v2, Poetry
- **Frontend**: React 18, TypeScript, Vite, TanStack Router (file-based, auto code-splitting), Bun, MUI v5, Zustand, TanStack Query, ReactFlow
- **Real-time**: WebSockets — Celery events flow through a threaded receiver -> async queue -> broadcaster -> WebSocket -> Zustand stores
- **Architecture**: Bun is the single entrypoint — serves the SPA, spawns the Python backend as a child process (on port 8556 internally), and reverse-proxies API/WS to it. External port is 8555.

## Repo Map

- `server/` — backend. Each domain (`tasks/`, `workers/`, `events/`, `ws/`, `search/`, `server_info/`) has its own `model.py`, `router.py`, and `_test.py` files
- `server/settings.py` — all config via env vars (`BROKER_URL`, `RESULT_BACKEND`, etc.), reads `server/.env`
- `server/events/receiver.py` + `broadcaster.py` — the core real-time pipeline
- `frontend/app/` — frontend source (TanStack Router file-based routing)
- `frontend/app/routes/` — file-based routes (auto code-split per route)
- `frontend/app/stores/` — Zustand state (tasks, workers, WebSocket status, settings)
- `frontend/app/services/server/` — auto-generated OpenAPI client, **never edit manually**
- `frontend/app/components/` — organized by domain, mirrors backend modules
- `frontend/vite.config.ts` — Vite config with TanStack Router plugin and dev proxy rules
- `frontend/bun-entry.ts` — Production entry: spawns Python, serves SPA, proxies API/WS
- `CONTRIBUTING.md` — full code style guide and design guidelines
- `CONFIGURATION.md` — all environment variables and setup options

## Conventions

- **Python**: Ruff (line-length 120). Absolute imports only (relative banned). Pydantic models, not dicts. Async-first — use `asyncio.to_thread` for blocking code. Register new loggers in `logging_config.py`.
- **TypeScript**: Prettier (tabWidth 4, no semis, printWidth 120). Arrow functions. `useMemo` for derived state, never `useState`+`useEffect` for it. Path alias `@*` -> `app/*`.
- **Tests**: Colocated, suffixed `_test.py` (not prefixed `test_`). Pythonpath is `server/`, so imports start from package root.

## Development

1. **Terminal 1**: `cd server && python run.py` (Python backend on port 8555)
2. **Terminal 2**: `cd frontend && bun dev` (Vite dev server on port 3000)

The Vite dev server handles HMR and proxies `/api/*` and `/ws/*` to Python at 8555.

## Mindset

This is a monitoring tool — it observes, never mutates the Celery cluster. Prioritize real-time responsiveness and clear data presentation. The target user is a developer debugging their Celery setup, so surface full technical detail rather than abstracting it away. Keep the UI information-dense. Performance matters: avoid unnecessary re-renders on the frontend and avoid blocking the async event loop on the backend.
