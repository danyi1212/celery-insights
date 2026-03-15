# Contributing to Celery Insights

This guide covers bug reports, feature requests, local development, and the project conventions contributors are expected to follow.

## Reporting Bugs

> :warning: **WARNING**
>
> If you have discovered a security vulnerability, please **DO NOT** file a public issue.
> Instead, please report them directly to <danyi1212@users.noreply.github.com>.

If you have found a bug, we would like to know. Before you file a bug report, make sure the issue can be reproduced consistently.

To report a bug, create a new GitHub issue with the `bug` label and include a minimal reproduction plus any steps needed to reproduce it.

When the issue depends on real task history, logs, or runtime config, also attach a redacted `debug bundle v2` from **Settings** -> **Download diagnostics**. Keep secrets redacted unless someone investigating the issue explicitly asks for the unredacted bundle.

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

### Prerequisites

- Python 3.14+
- [Bun](https://bun.sh/)
- [SurrealDB](https://surrealdb.com/install) (v3.0+)
- An IDE (we suggest PyCharm, but you can use your preferred IDE)

### Create dev environment

1. Clone your fork of the Celery Insights repository.

    ```shell
    git clone https://github.com/<your_username>/celery-insights.git
    ```

2. Navigate to the root folder of the repository.

    ```shell
    cd celery-insights/
    ```

3. Install the Python dependencies using [uv](https://docs.astral.sh/uv/).

    ```shell
    uv sync
    ```

4. Install pre-commit hooks

   ```shell
   pre-commit install
   ```

5. Install the frontend dependencies using Bun.

    ```shell
    bun install
    ```

6. Create `.env` file

    ```shell
    cd server/
    cp .env.example .env
    ```

### Run the development stack

The quickest way to start all services at once is:

```shell
bun run dev:all
```

If you use `just`, the repo also includes `just dev`, `just lint`, `just typecheck`, and related helper recipes.

### Debug bundles and snapshot replay

Use this workflow when you need to reproduce a real incident locally without reconnecting to the original broker or result backend.

Capture:

```shell
# From the running app UI:
# Settings -> Download diagnostics
```

Replay with the local test compose stack:

```shell
just start
just start-reload
just start-debug /absolute/path/to/debug-bundle-v2.zip
```

What these recipes do:

- `just start` starts `test_project/docker-compose.yml` in detached mode
- `just start-reload` rebuilds and recreates only the `celery-insights` service
- `just start-debug ...` starts the test stack with `DEBUG_BUNDLE_PATH` set on the `celery-insights` service

Replay mode is offline and read-only by design. It restores the bundled `task`, `event`, and `worker` data into embedded SurrealDB and disables mutating settings actions.

Or run them in separate terminals:

1. Start SurrealDB

    ```shell
   bun run dev:surreal
   ```

2. Start the Python ingester (provided PyCharm run configuration `run server`)

    ```shell
   cd server/
   python run.py
   ```

3. Start the frontend dev server (provided PyCharm run configuration `dev`)

    ```shell
   bun dev
   ```

4. Open browser to <http://localhost:3000>

> **Note:** All application settings are owned by Bun (`runtime/config.ts`) and passed to Python via environment variables. The Bun package root is the repository root, but the application source now lives at the repository root under `src/`, `runtime/`, and `e2e/`. When adding new configuration, define it in the Bun config schema first.

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
- Avoid storing React state multiple times. Use `useMemo` for derived states. Example:

    ```tsx
    const MyComponent: React.FC<{items: string[]}> = ({items}) => {
        // Dont
        const [lengthBad, setLength] = useState(items.length)
        useEffect(() => setLength(items.length), [items])

        // Do
        const lengthGood = useMemo(() => items.length, [items])
    }
    ```

- Avoid unnecessary React re-renders. Performance is important.
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

Code should be test-covered as much as possible.

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

This now runs in two passes:
- `bun run e2e:parallel` runs the parallel-safe specs with 2 Playwright workers.
- `bun run e2e:serial` runs shared-state specs with 1 worker.
- `bun run e2e` still produces one merged Playwright report after both passes finish.

**With the stack already running** (faster iteration):

```shell
cd test_project && docker compose --profile interactive up --build -d
E2E_SKIP_COMPOSE=1 bun run e2e
```

**Headed mode** (opens a browser so you can watch the tests run):

```shell
E2E_SKIP_COMPOSE=1 bun run e2e:headed
```

**Playwright UI mode** (interactive test runner with time-travel debugging):

```shell
E2E_SKIP_COMPOSE=1 bun run e2e:ui
```

> **Tip:** When iterating locally, keep the docker-compose stack running and use `E2E_SKIP_COMPOSE=1` to skip the slow build step. Use `--headed` to see what the tests are doing, or `--ui` for the full Playwright inspector.

## License

Celery Insights is licensed under the [BSD 3-Clause License](LICENSE).
By contributing to this project, you agree to license your contribution under the same license as the project.

## Code of Conduct

Please note that the Celery Insights project is released with a Contributor Code of Conduct. By contributing to this
project, you agree to abide by its terms. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for more information.

## Contact

If you have any questions or concerns, feel free to contact @danyi1212.
