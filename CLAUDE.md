# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Backend** (from repo root): `uv run pytest`, `uv run ruff check server/`, `uv run ruff format server/`, `uv run ty check server/`
**Frontend** (from `frontend/`): `bun dev`, `bun run build`, `bun run lint`, `bun run lint-fix`
**Frontend tests** (from `frontend/`): `bun run test`, `bun run test:watch`
**Start all dev services** (from `frontend/`): `bun run dev:all` (starts SurrealDB, Python, and Vite concurrently)
**Start SurrealDB only** (from `frontend/`): `bun run dev:surreal`

Tests are colocated: `model.py` -> `model_test.py`, `task-avatar.tsx` -> `task-avatar.test.tsx`. Run one with `uv run pytest server/tasks/model_test.py` or `cd frontend && bunx vitest run app/components/task/task-avatar.test.tsx`.

## Stack

- **Backend**: FastAPI, Python 3.12, Celery 5.4, Pydantic v2, uv, ty (type checker)
- **Database**: SurrealDB (embedded subprocess or external) — single source of truth for tasks, workers, and events
- **Frontend**: React 19, TypeScript, Vite, TanStack Router (file-based, auto code-splitting), Bun, Shadcn UI, Tailwind CSS v4, Lucide React, Zustand, TanStack Query, TanStack Table, @xyflow/react v12, SurrealDB JS SDK
- **Frontend testing**: Vitest, Testing Library (React + user-event + jest-dom), happy-dom
- **Real-time**: SurrealDB live queries — Celery events flow through a threaded receiver -> async queue -> SurrealDB ingester (batched writes) -> live queries -> React components
- **Architecture**: Bun is the single entrypoint (port 8555) — orchestrates SurrealDB (port 8557), spawns Python ingester (port 8556) via leader election, proxies `/api/*` to Python and `/surreal/*` to SurrealDB, and serves the SPA. Python is a pure ingestion process. Frontend talks directly to SurrealDB via live queries.

## Repo Map

- `server/` — backend (pure ingestion). Domains: `tasks/`, `workers/`, `events/`, `server_info/`
- `server/settings.py` — Python config via env vars (received from Bun), reads `server/.env`
- `server/surrealdb_client.py` — Python SurrealDB client module
- `server/events/receiver.py` + `ingester.py` — Celery event receiver + SurrealDB batched ingester
- `server/tasks/result_fetcher.py` — fetches task results from Celery result backend
- `server/workers/poller.py` — periodic worker status polling via Celery inspect API
- `server/cleanup.py` — periodic data retention/pruning job
- `frontend/src/config.ts` — Bun-owned settings (Zod-validated), the single source of truth for all config
- `frontend/src/logger.ts` — Bun logger utility (`bunLogger`, `surrealLogger`, `createLogger`)
- `frontend/src/surreal-schema.ts` — SurrealDB schema migration (creates tables, users, permissions)
- `frontend/src/leader-election.ts` — distributed leader election via SurrealDB atomic locks
- `frontend/bun-entry.ts` — Production entry: orchestrates SurrealDB + Python subprocesses, runs leader election, serves SPA, proxies API/WS/SurrealDB
- `frontend/app/` — frontend source (TanStack Router file-based routing)
- `frontend/app/routes/` — file-based routes (auto code-split per route)
- `frontend/app/hooks/use-live-query.ts` — generic SurrealDB live query hook
- `frontend/app/hooks/use-live-tasks.ts`, `use-live-workers.ts`, `use-live-events.ts` — domain-specific live query hooks
- `frontend/app/hooks/use-search.ts` — search via SurrealDB queries
- `frontend/app/stores/` — Zustand state (settings, explorer config, tour)
- `frontend/app/components/surrealdb-provider.tsx` — SurrealDB connection provider (remote + WASM demo mode)
- `frontend/app/components/` — organized by domain, mirrors backend modules
- `frontend/app/lib/utils.ts` — `cn()` helper for Tailwind class merging
- `frontend/components.json` — Shadcn UI config (style variant, path aliases, CSS location)
- `frontend/vitest.config.ts` — Vitest configuration (happy-dom, colocated `.test` pattern)
- `frontend/app/test-utils.tsx` — Custom `render` that wraps components with required providers
- `frontend/app/test-fixtures.ts` — Shared factory helpers (`createServerTask`, `createStateTask`, etc.)
- `frontend/vite.config.ts` — Vite config with TanStack Router plugin and dev proxy rules
- `CONTRIBUTING.md` — full code style guide and design guidelines
- `CONFIGURATION.md` — all environment variables and setup options

## Conventions

- **Python**: Ruff (line-length 120). Absolute imports only (relative banned). Pydantic models, not dicts. Async-first — use `asyncio.to_thread` for blocking code. Register new loggers in `logging_config.py`. Use `logging.getLogger(__name__)` — never `print()`.
- **Logging (Bun)**: Use `bunLogger` from `frontend/src/logger.ts` — never raw `console.log/warn/error`. For new services, use `createLogger("service-name")`. SurrealDB output is piped through `surrealLogger`.
- **TypeScript**: Prettier (tabWidth 4, no semis, printWidth 120). Arrow functions. `useMemo` for derived state, never `useState`+`useEffect` for it. Path alias `@*` -> `app/*`.
- **UI**: Shadcn UI components in `frontend/app/components/ui/`. Tailwind CSS v4 for styling (CSS-first config in `app/styles.css`). Lucide React for icons. Dark mode via `.dark` class on `<html>`. Use `cn()` from `@lib/utils` for conditional class merging.
- **Tests (Python)**: Colocated, suffixed `_test.py` (not prefixed `test_`). Pythonpath is `server/`, so imports start from package root.
- **Tests (Frontend)**: Colocated, suffixed `.test.ts` / `.test.tsx`. Vitest with happy-dom. Use custom `render` from `app/test-utils.tsx` (wraps providers). Shared factories in `app/test-fixtures.ts`.

## Development

The quickest way to start all three services:

```
cd frontend && bun run dev:all
```

Or run them in separate terminals:

1. **Terminal 1**: `cd frontend && bun run dev:surreal` (SurrealDB on port 8557)
2. **Terminal 2**: `cd server && python run.py` (Python ingester on port 8556)
3. **Terminal 3**: `cd frontend && bun dev` (Vite dev server on port 3000)

The Vite dev server handles HMR and proxies `/api/*` to Python at 8556, `/surreal/*` to SurrealDB at 8557.

## Deployment

Published as a Docker container. SurrealDB (v2.1.4) is bundled in the image. Use `SURREALDB_STORAGE` to configure persistence (`memory` default, `rocksdb://path`, `surrealkv://path`). For scaled deployments, point multiple instances at an external SurrealDB via `SURREALDB_EXTERNAL_URL`. After changing dependencies or the build pipeline, verify with `docker build .`.

## Mindset

This is a monitoring tool — it observes, never mutates the Celery cluster. Prioritize real-time responsiveness and clear data presentation. The target user is a developer debugging their Celery setup, so surface full technical detail rather than abstracting it away. Keep the UI information-dense. Performance matters: avoid unnecessary re-renders on the frontend and avoid blocking the async event loop on the backend.

## Checklist

- Never use `npm` or `yarn` commands. Always use `bun`.
- Never use `poetry` or `pip` commands. Always use `uv`.
- Never use `rm` commands. Always use `trash`.
