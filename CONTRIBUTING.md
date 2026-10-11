## Application authentication during development

Bun owns configured HTTP Basic accounts and every application request. Configure a secret-backed TOML file selected by `CELERY_INSIGHTS_CONFIG_FILE`, explicit accounts/roles, and HTTPS ingress matching `installation.public_url`. See [the example](docs/configuration.example.toml). Vite application routes must pass through Bun; do not introduce direct Python or database proxies to bypass authentication. The TLS E2E fixture supplies synthetic configured accounts and an ingress automatically for tests.

Python is the Celery bridge. Authentication secrets stay out of Python and browser storage. There are no password hashes, account/session tables, MFA or account lifecycle APIs to develop. OIDC is a separate maintained-library integration; OPA can restrict application permissions.

# Contributing to Celery Insights

This guide covers bug reports, feature requests, local development, and the project conventions contributors are expected to follow.

## Reporting Bugs

> :warning: **WARNING**
>
> If you have discovered a security vulnerability, please **DO NOT** file a public issue.
> Instead, please report them directly to <security@danyi.io>.

If you have found a bug, we would like to know. Before you file a bug report, make sure the issue can be reproduced consistently.

To report a bug, create a new GitHub issue with the `bug` label and include a minimal reproduction plus any steps needed to reproduce it.

When the issue depends on real task history, logs, or runtime config, also attach a redacted `debug bundle v2` from **Settings** -> **Download diagnostics**. Configuration credentials are always redacted; review task payloads and logs before sharing.

If you are not sure whether it is a bug, start with GitHub Discussions. Other users may have seen the same behavior and can help narrow it down.

## Asking Questions and Requesting Features

If you have a question, idea, or feature request, start in GitHub Discussions.

For feature requests, open a GitHub issue with the `enhancement` label after the discussion.

## Contribution Process

To contribute to the project, follow these steps:

1. Fork the repository.
2. Create a branch with a descriptive name, using prefixes like `feature/` or `bug/` for the branch names.
3. Make your changes in the branch.
4. Run the project checks before you open the pull request:
   - For Python code: [ruff](https://github.com/astral-sh/ruff), [ty](https://github.com/astral-sh/ty), and `pytest`
   - For frontend code: [Oxlint](https://oxc.rs/docs/guide/usage/linter.html), [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html), TypeScript, and Vitest
5. Open a pull request to the main branch.
6. Check the CI workflow statuses and for comments on your pull request.

## Local development

Requirements: Bun, uv, Python 3.14+, Docker for E2E, and SurrealDB 3.3.0 for native database tests. Pinned runtime versions live in `Dockerfile`, `package.json` and `.python-version`.

```sh
git clone https://github.com/<your_username>/celery-insights.git
cd celery-insights
bun install
uv sync
uv run pre-commit install
```

Configure accounts, a session secret and `installation.public_url` using [the setup example](src/content/docs/setup.mdx). Keep secrets out of Git. Select your TOML file with `CELERY_INSIGHTS_CONFIG_FILE`.

```sh
export CELERY_INSIGHTS_CONFIG_FILE=/absolute/path/to/config.toml
bun run dev:all
```

- Bun supervises SurrealDB and the private Python Celery bridge; Vite serves the frontend on port 3000.
- Authentication requires HTTPS ingress matching `installation.public_url`. Route frontend traffic to Vite and API/WebSocket traffic to Bun on port 8555.
- Run `bun run dev` for Vite alone, or `bun run dev:server` for the Bun supervisor alone.
- Python is launched through Bun with a validated settings snapshot, not a separate public server or `server/.env`.
- Add application settings to the Bun schema/registry. Python receives only its required subset.

### Diagnostics and replay

Download diagnostics from **Settings** while the problem is visible. Configuration credentials are always redacted, but task data and logs may still contain sensitive information.

```sh
just start                                     # local test cluster
just reload                                    # rebuild the app service
just start-debug /absolute/path/to/bundle.zip   # offline, read-only replay
```

These helpers use `test_project/docker-compose.yml`; supply your authentication TOML and secret inputs for manual deployments. E2E creates its own authenticated fixture.

### Runtime and MCP

- Bun owns APIs, metrics, exports, backups, retention and authorization.
- Python collects Celery observations through a private Unix socket created by Bun.
- Production browsers use typed observation reads; the demo uses local WASM queries.
- MCP is served by Bun at `/mcp`, with the same configured accounts. See [client setup](CONFIGURATION.md#mcp-access-for-agents) and [tool contracts](MCP_DESIGN.md).
- `runtime/mcp/` owns validation, queries, cursors and response budgets. Tools read stored observations without controlling Celery.

Native acceptance:

```sh
bun run test:observation
bun run test:security
```

## Code Styles

### General

- Write short, concise functions and classes.
- Provide detailed types and variables, including generics when needed.
- Do not abbreviate variable and function names.

### Python

- Use type annotations, including generics when required. Code should be 100% type covered.
- Avoid creating undocumented dictionaries. Use dataclasses, Pydantic models, classes, named tuples, etc.
- Avoid blocking the main thread. Use asyncio interfaces whenever possible, or use asyncio.to_thread for blocking code.
- Always log exceptions and errors. New package loggers should be added to `logging_config.py`.
- Test files should end with `_test.py`, and not start with `test_?.py`.

### TypeScript

- Use TypeScript only, avoid using vanilla JavaScript.
- Provide detailed types and variables, including generics when needed.
- Prefer arrow functions and one-liner expressions.
- Avoid storing React state multiple times. Compute derived values during render; use `useMemo` when caching an expensive computation helps. Example:

    ```tsx
    const TaskCount = ({ items }: { items: string[] }) => <span>{items.length}</span>
    ```

- Bun commands and tooling run from the repository root.
- Keep the frontend split by responsibility:
  - `src/` for the browser application
  - `runtime/` for the Bun server/runtime layer
  - `e2e/` for Playwright coverage
- Routes use [TanStack Router](https://tanstack.com/router) with file-based routing. `src/routeTree.gen.ts` is auto-generated — do not edit manually.

### UI Components & Styling

- Use [Shadcn UI](https://ui.shadcn.com/) components from `src/components/ui/`. Add new Shadcn components via `bunx shadcn@latest add <component>`.
- Style with Tailwind CSS v4 utility classes. Theme configuration is CSS-first in `src/styles.css` (no `tailwind.config.js`).
- Use `cn()` from `@lib/utils` for conditional class merging.
- Use [Lucide React](https://lucide.dev/) for all icons.
- Dark mode is toggled via `.dark` class on `<html>`. Use Tailwind's `dark:` variant for dark-mode-specific styles.

### Design Guidelines

- Users are likely to be technical, so provide full information and messages.
- Always show task avatars instead of IDs, and type colors near task types.
- Add tooltips with description and help icons where needed.
- Reactions should be near interactions; avoid toasters, popups, etc.
- Add placeholders for loading or empty containers.
- Display error inside components and provide detailed information.

## Testing

Test changed behavior and failure cases. Keep fixtures deterministic.

Unit tests should be written close to the module they are testing, with the same module name.
For example, tests for `models.py` should be at `models_test.py` in the same folder.

### Unit tests (Python)

```shell
uv run pytest                              # all tests
uv run pytest server/tasks/model_test.py   # single file
```

### Unit tests (Frontend)

Frontend unit tests use [Vitest](https://vitest.dev/) with [Testing Library](https://testing-library.com/) and happy-dom.
Tests are colocated next to the module they test, suffixed `.test.ts` or `.test.tsx` (e.g., `task-avatar.tsx` -> `task-avatar.test.tsx`).

MCP integration tests start an isolated in-memory SurrealDB process and require the SurrealDB 3.3+ CLI
on PATH (production and CI use v3.3.0). They exercise real queries, paging, viewer permissions,
schema migration, and the HTTP protocol. Set `MCP_TEST_URL` only for a disposable test server;
the tests clear data in its `test/mcp` database.
The Python ingestion integration test also starts an isolated SurrealDB process; it skips when
the CLI is unavailable locally, and CI installs the CLI to run it.

```shell
bun run test          # all tests (single run)
bun run test:watch    # watch mode
```

- Use the custom `render` from `src/test-utils.tsx` instead of the raw Testing Library `render` — it wraps components with required providers.
- Use factory helpers from `src/test-fixtures.ts` to create test data (`createServerTask`, `createStateTask`, `createServerWorker`).

### E2E tests (Playwright)

E2E tests run against the full docker-compose stack (celery-insights + Celery workers + RabbitMQ + Redis + interactive API).

**Full lifecycle** (starts and stops docker-compose automatically):

```shell
bun run e2e
```

**With previously built images** (faster iteration):

```shell
E2E_SKIP_BUILD=1 bun run e2e  # reuse existing images, still create the authenticated fixture
```

**Headed mode** (opens a browser so you can watch the tests run):

```shell
bun run e2e:headed
```

**Playwright UI mode** (interactive test runner with time-travel debugging):

```shell
bun run e2e:ui
```

`E2E_SKIP_COMPOSE=1` skips startup and teardown; use it only with an existing authenticated E2E stack.

### Reverse proxy E2E coverage

For new frontend features, use `appUrl` from `src/lib/app-url.ts` for same-origin endpoints and public assets, and `appHref` for plain anchor links. TanStack Router links apply the mount path automatically.

CI runs the complete Playwright suite at the origin root and behind nginx at `/tools/celery/`. Run the proxy deployment locally with:

```shell
URL_PREFIX=/tools/celery bun run e2e
```

Use the shared `e2e/fixtures/base` fixture for new browser tests. Its `page.goto("/...")` destinations are relative to the app mount. In the proxy deployment it also fails tests when app HTTP requests or WebSockets escape the prefix. Use `appURL` from `e2e/helpers/app-url` for direct endpoint requests. The proxy serves a sibling application at `/` and returns 404 for other paths outside the prefix.

## License

Celery Insights is licensed under the [BSD 3-Clause License](LICENSE).
By contributing to this project, you agree to license your contribution under the same license as the project.

## Code of Conduct

Please note that the Celery Insights project is released with a Contributor Code of Conduct. By contributing to this
project, you agree to abide by its terms. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for more information.

## Contact

If you have any questions or concerns, feel free to contact @danyi1212.
