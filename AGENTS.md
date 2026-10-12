# Celery Insights

Open-source Celery monitoring for local development, staging and production. The dashboard and read-only MCP tools help people and agents investigate cluster workflows, tasks and workers. The service observes Celery; it does not control the cluster.

**Before making changes, read [CONTRIBUTING.md](CONTRIBUTING.md). Its coding, writing, testing and user-experience standards are mandatory.**

## Stack

- Runtime: Bun, TypeScript, Zod; Python, FastAPI, Celery, Pydantic, uv.
- Storage: SurrealDB; local WASM database for the demo.
- Frontend: React, Vite, TanStack Router/Query/Table, Zustand, Shadcn, Tailwind, React Flow.
- Verification: Vitest, Testing Library, pytest, Playwright, Oxlint/Oxfmt, Ruff, ty.

## Repository router

- `bun-entry.ts`, `runtime/`: supervisor, configuration, authentication/OPA, APIs, typed observation reads, MCP, metrics and maintenance.
- `server/`: private Python Celery bridge—event ingestion, result enrichment and worker polling. Bun launches it with validated settings.
- `runtime/surreal-schema.ts`, `runtime/observation/`: database schema and authorized read queries; replicas share external storage.
- `src/`: browser app; `routes/` owns pages, `components/` owns UI, `hooks/` owns reads and `stores/` owns browser preferences.
- `src/content/docs/`: operator documentation bundled into the app.
- `e2e/`, `test_project/`, `tooling/`: authenticated integration fixtures, example Celery cluster and native verification.
- `deploy/`, `Dockerfile`, `.github/`: container entrypoint, packaging and CI.

## Development and references

- Setup, commands, checks, issues and PRs: [CONTRIBUTING.md](CONTRIBUTING.md). Run from the repo root; use `package.json`, `pyproject.toml` and `justfile` for command details.
- Deployment/configuration changes: [CONFIGURATION.md](CONFIGURATION.md); OPA changes: [AUTHORIZATION.md](AUTHORIZATION.md); MCP changes: [MCP_DESIGN.md](MCP_DESIGN.md).
- Review user-facing changes through the actual user workflow, following the UX review checklist in `CONTRIBUTING.md`.
- Keep plans, progress and run-specific results in issues or PR descriptions/comments. Repository docs describe reusable, current behavior.
