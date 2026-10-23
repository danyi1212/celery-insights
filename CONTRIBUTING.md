# Contributing to Celery Insights

These standards apply to human and agent contributions. Read them before changing code, UI or documentation.

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
5. Review the change through the user workflow described below.
6. Open a pull request to `main` explaining the problem, resulting behavior, validation and remaining limitations. Link its issue when one exists.
7. Address review feedback and failing CI checks. Keep plans, progress and run-specific results in the issue or PR, not new repository documents.

## Local development

Requirements: Bun, uv, Python 3.14+, Docker for E2E, and SurrealDB 3.3.4 for native database tests. Pinned runtime versions live in `Dockerfile`, `package.json` and `.python-version`.

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

### Authentication during development

- Configure explicit password accounts or OIDC, a shared session secret and HTTPS ingress matching `installation.public_url`. See [the configuration example](docs/configuration.example.toml).
- Route application API and WebSocket requests through Bun. The TLS E2E fixture supplies synthetic accounts and ingress for tests.
- Keep authentication secrets out of Python and browser storage. Account lifecycle and MFA belong to the external identity provider; OPA can restrict application permissions.

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


## Helm chart development

Operator installation and configuration live in the [Kubernetes documentation](src/content/docs/kubernetes.mdx). To work on the chart from a checkout:

```sh
helm repo add surrealdb https://helm.surrealdb.com
helm dependency build charts/celery-insights
helm lint --strict charts/celery-insights
uv run python tooling/helm/chart_test.py
```

Use the local chart path instead of its OCI URL when installing a checkout. Set `image.tag` to an image built from the same source, and supply your installation values:

```sh
helm upgrade --install insights charts/celery-insights \
  --namespace celery-insights -f values.yaml --set image.tag=YOUR-IMAGE-TAG --wait
```

Kubernetes E2E uses a disposable Kind cluster named `celery-helm`. Build and load `celery-insights-helm:e2e` and `celery-insights-test-project:local`, install Playwright Chromium, then run `uv run python tooling/helm/e2e.py`. The runner owns its fixture namespace; do not run it against a shared cluster. CI exercises Helm 3 and 4, TLS login, replicas, failover, storage and CPU HPA.

The publication workflow validates generated authentication configuration inside the selected released application image. Chart and application versions are independent. Before setting `celery-insights.io/release-ready` to `true`, verify that image and hosted Cloud access. A `chart-vVERSION` tag matching `Chart.yaml` publishes the OCI package. Record release verification results in the PR or issue.

## Coding standards

### General

- Keep functions focused and use names that explain their purpose.
- Type interfaces and boundaries; use generics when they express a real relationship.
- Keep changes in the owning process. Bun owns application configuration and requests; Python owns Celery collection.
- Follow repository formatter/linter configuration. Use Bun for JS tooling and uv for Python tooling.
- Use `trash` instead of shell `rm` when removing files.

### Python

- Use type annotations, including generics when required. Code should be 100% type covered.
- Avoid creating undocumented dictionaries. Use dataclasses, Pydantic models, classes, named tuples, etc.
- Avoid blocking the main thread. Use asyncio interfaces whenever possible, or use asyncio.to_thread for blocking code.
- Use `logging.getLogger(__name__)` for operational logs and errors. Register new package loggers in `logging_config.py`.
- Use absolute imports from the Python package root.
- Test files should end with `_test.py`, and not start with `test_?.py`.

### TypeScript

- Use TypeScript only, avoid using vanilla JavaScript.
- Prefer arrow functions where they improve readability; keep expressions readable.
- Use `bunLogger` or `createLogger` from `runtime/logger.ts` for Bun runtime logs.
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

## Writing and documentation

- Lead with the action, result or fact the reader needs. Use plain language and short paragraphs.
- Use bullets for steps or parallel choices, tables for comparisons and inline code blocks for runnable examples.
- Explain why a constraint exists when it is not obvious. Remove comments that only narrate the code.
- Describe verified behavior and limits. Missing observations do not prove success, inactivity or an absent relationship.
- Keep error messages specific: what failed, what is known and what the user can do next. Avoid guessed causes and promotional copy.
- Maintain one source for each instruction; link to it instead of copying it. Update the relevant operator page when setup or behavior changes.
- Keep issue plans, progress reports and dated test results in GitHub. Repository documentation should remain useful after the PR merges.

## User-experience review

Review every feature or change as the user will encounter it, not only as a code diff:

- Start from the user's entry point and complete the intended task with realistic data and permissions.
- For UI changes, use the running app. Check loading, empty, error and restricted states, plus recovery or retry where relevant.
- Check responsive layout, keyboard use, clear labels and feedback next to the affected action.
- Distinguish browser preferences from shared server settings. Label unavailable or restricted observations without inventing values.
- For APIs, MCP and deployment changes, exercise the client, tool call or documented command the user will run.
- In the PR, report what you exercised and any gaps. Use task avatars/type colors for scanning while keeping technical identifiers available when needed.

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
on PATH (production and CI use v3.3.4). They exercise real queries, paging, viewer permissions,
schema migration, and the HTTP protocol. Set `MCP_TEST_URL` only for a disposable test server;
the tests clear data in its `test/mcp` database.
The Python ingestion integration test also starts an isolated SurrealDB process; it skips when
the CLI is unavailable locally, and CI installs the CLI to run it.

To compare search indexing workloads locally, run the same integration test with an output path:

```sh
SEARCH_BENCHMARK_OUTPUT=/tmp/search-index-workloads.jsonl uv run pytest server/events/search_indexing_integration_test.py --log-cli-level=INFO
```

The report measures the local test workload, not production throughput. Keep run-specific results in the relevant issue or PR.

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

CI runs the application suite at the origin root. With a URL prefix, Playwright runs only `reverse-proxy.spec.ts`: login redirects and cookie scope, assets, deep links, WebSockets, documentation links, downloads, MCP and sibling-route isolation. The separate OIDC browser acceptance checks callbacks at both paths.

Run the focused proxy suite locally with:

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
