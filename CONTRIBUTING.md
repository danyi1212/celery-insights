# Contributing to Celery Insights

Thank you for your interest in contributing to Celery Insights! This document will help guide you through the process.

## Reporting Bugs

> :warning: **WARNING**
>
> If you have discovered a security vulnerability, please **DO NOT** file a public issue.
> Instead, please report them directly to <danyi1212@users.noreply.github.com>.

If you have found a bug, we would like to know, so we can fix it! Before you file a bug report, please make sure that
the bug
can be reproduced consistently.

To report a bug, create a new GitHub Issue with the "bug" label. Make sure to include a minimal reproduction of the bug
and any steps needed to reproduce it.

Please feel free to discuss it in GitHub Discussions first. Other users may have experienced a similar issue and can
provide insights or guidance on how to overcome it.

## Asking Questions and Requesting Features

If you have any questions, ideas, or want to request a feature, feel free to discuss them in GitHub Discussions.

For feature requests, create a new GitHub Issue with the "enhancement" label after discussing it in GitHub Discussions.

## Contribution Process

To contribute to the project, follow these steps:

1. Fork the repository.
2. Create a branch with a descriptive name, using prefixes like `feature/` or `bug/` for the branch names.
3. Make your changes in the branch.
4. Make sure to run linters and formatters:
   - For Python code: [ruff](https://github.com/charliermarsh/ruff)
   - For TypeScript code: [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/)
5. Open a pull request to the main branch.
6. Check the CI workflow statuses and for comments on your pull request.

## Setting up a local development environment

### Prerequisites

- Python 3.14+
- [Bun](https://bun.sh/)
- [SurrealDB](https://surrealdb.com/install) (v3.0+)
- An IDE (we suggest PyCharm, but you can use your preferred IDE)

### Create dev environment

1. Clone your fork of the Celery Insights repository.

    ```shell
    git clone https://github.com/<your_username>/celery_insights.git
    ```

2. Navigate to the root folder of the repository.

    ```shell
    cd celery_insights/
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
    cd frontend/
    bun install
    ```

6. Create `.env` file

    ```shell
    cd ../server/
    cp .env.example .env
    ```

### Run dev server

The quickest way to start all services at once:

```shell
cd frontend/
bun run dev:all
```

Or run them in separate terminals:

1. Start SurrealDB

    ```shell
   cd frontend/
   bun run dev:surreal
   ```

2. Start the Python ingester (provided PyCharm run configuration `run server`)

    ```shell
   cd server/
   python run.py
   ```

3. Start the frontend dev server (provided PyCharm run configuration `dev`)

    ```shell
   cd frontend/
   bun dev
   ```

4. Open browser to <http://localhost:3000>

> **Note:** All application settings are owned by Bun (`frontend/src/config.ts`) and passed to Python via env vars. When adding new configuration, define it in the Bun config schema first.

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
- Frontend source code lives in `frontend/app/` (routes in `app/routes/`, components in `app/components/`, stores in `app/stores/`).
- Routes use [TanStack Router](https://tanstack.com/router) with file-based routing. `frontend/app/routeTree.gen.ts` is auto-generated — do not edit manually.

### UI Components & Styling

- Use [Shadcn UI](https://ui.shadcn.com/) components from `frontend/app/components/ui/`. Add new Shadcn components via `bunx shadcn@latest add <component>`.
- Style with Tailwind CSS v4 utility classes. Theme configuration is CSS-first in `frontend/app/styles.css` (no `tailwind.config.js`).
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
cd frontend
bun run test          # all tests (single run)
bun run test:watch    # watch mode
```

- Use the custom `render` from `app/test-utils.tsx` instead of the raw Testing Library `render` — it wraps components with required providers.
- Use factory helpers from `app/test-fixtures.ts` to create test data (`createServerTask`, `createStateTask`, `createServerWorker`).

### E2E tests (Playwright)

E2E tests run against the full docker-compose stack (celery-insights + Celery workers + RabbitMQ + Redis + interactive API).

**Full lifecycle** (starts and stops docker-compose automatically):

```shell
cd frontend
bun run e2e
```

**With the stack already running** (faster iteration):

```shell
cd test_project && docker compose --profile interactive up --build -d
cd ../frontend
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
