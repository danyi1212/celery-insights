# Repository guidance

## Ownership

- Bun owns configuration, authentication/OPA, application APIs, observation reads, metrics, backups and cleanup. `bun-entry.ts` starts the runtime and serves the SPA.
- Python handles Celery events, result enrichment and worker polling through a private Unix socket created by Bun. Start it through the Bun supervisor; `server/run.py` requires a validated settings snapshot.
- Production browsers use typed reads and refresh subscriptions through `/api/observation/rpc`. The demo uses a local WASM database.
- SurrealDB stores observed tasks, workers and events. Multi-replica deployments share an external database and elect one ingester.

## Workflows

Run commands from the repository root. Use Bun for JS dependencies and uv for Python dependencies.

```sh
bun install
uv sync
bun run dev:all              # Bun supervisor and Vite
bun run check:frontend       # types, lint, format, tests
uv run ruff check server/
uv run ruff format --check server/
uv run ty check server/
uv run pytest
bun run e2e                 # isolated authenticated Docker stack
```

Development needs explicit authentication configuration and HTTPS ingress; follow [CONTRIBUTING.md](CONTRIBUTING.md#local-development). Versions and commands live in `package.json`, `pyproject.toml`, `Dockerfile` and `justfile`.

## Conventions

- Keep changes within the owning process. Add settings to the Bun schema/registry before passing a required subset to Python.
- Use `bunLogger`/`createLogger` in Bun and `logging.getLogger(__name__)` in Python. Move blocking Python calls into `asyncio.to_thread`.
- Frontend styling uses Shadcn, Tailwind and `cn()`. Use `appUrl`/`appHref` for same-origin URLs and plain anchors under a deployment prefix.
- Colocate `.test.ts(x)` and `_test.py` files. Use `src/test-utils.tsx` for provider-aware rendering and `src/test-fixtures.ts` for factories.
- Follow the formatter and linter configuration. Prefer direct derived values over effect-synchronized state.
- Keep observations distinct from conclusions: missing data does not prove success, inactivity or an absent relationship.
- Use `trash` rather than shell `rm` for file removal.

## References

- [CONTRIBUTING.md](CONTRIBUTING.md): setup, checks and code conventions.
- [CONFIGURATION.md](CONFIGURATION.md): application configuration and deployment inputs.
- [AUTHORIZATION.md](AUTHORIZATION.md): OPA contract and policy examples.
- [MCP_DESIGN.md](MCP_DESIGN.md): tool semantics, budgets and pagination; consult when changing MCP.
- `src/content/docs/`: operator pages served in the app. Update the relevant page when changing user-facing setup or behavior.
