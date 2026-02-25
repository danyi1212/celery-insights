# Plan: Playwright E2E Tests for celery-insights

## Context

The project has no E2E testing infrastructure. The `test_project/` docker-compose now spins up a full Celery cluster (RabbitMQ, Redis, 2 workers, producer) plus celery-insights and an interactive FastAPI API (port 8000) that can trigger 27 named scenarios. This plan adds Playwright tests that start the docker-compose stack, exercise all major UI features against real Celery tasks, and run in GitHub Actions CI.

## File Structure

```
frontend/
  e2e/
    playwright.config.ts          # Config: serial, Chromium only, 30s timeout
    global-setup.ts               # docker compose --profile interactive up, health poll
    global-teardown.ts            # docker compose down -v
    helpers/
      scenario-client.ts          # HTTP client for interactive API (:8000)
      docker-compose.ts           # execSync wrappers for compose up/down
    fixtures/
      base.ts                     # Custom fixture: scenario client + API-level task waiter
    tests/
      navigation.spec.ts          # Sidebar links, 404, deep-link
      dashboard.spec.ts           # Workers, recent tasks, exceptions
      task-detail.spec.ts         # Header, charts, result card, args panel
      task-failures.spec.ts       # Exception display, retries, traceback
      task-canvas.spec.ts         # Chain/chord/group workflow graphs
      worker-detail.spec.ts       # Worker cards, pool, registered tasks
      explorer.spec.ts            # Table, facets, sorting, count
      raw-events.spec.ts          # Live stream, event facets, counter
      search.spec.ts              # Search box, results, no-results
      settings.spec.ts            # Theme, server info, debug bundle
      realtime.spec.ts            # WS indicator, live task arrival
```

## Implementation Steps

### 1. Install Playwright (`frontend/`)
- `bun add -d @playwright/test`
- `bunx playwright install chromium`
- Add to `frontend/package.json` scripts:
  - `"e2e": "playwright test --config e2e/playwright.config.ts"`
  - `"e2e:ui": "playwright test --config e2e/playwright.config.ts --ui"`
  - `"e2e:headed": "playwright test --config e2e/playwright.config.ts --headed"`

### 2. `frontend/e2e/playwright.config.ts`
- `baseURL: "http://localhost:8555"` — celery-insights production build in Docker
- `workers: 1`, `fullyParallel: false` — serial, shared docker-compose state
- `retries: 2` in CI, `0` locally
- `timeout: 30_000`, `expect.timeout: 10_000`
- Chromium only (fast, sufficient)
- `globalSetup` / `globalTeardown` for docker-compose lifecycle
- Reporters: `github` + `html` + `junit` in CI; `html` locally
- Trace/screenshot/video on failure only

### 3. `frontend/e2e/global-setup.ts`
- Skip if `E2E_SKIP_COMPOSE=1` (local dev with stack already running)
- `docker compose -f ../../test_project/docker-compose.yml --profile interactive up -d --build --wait` (3 min timeout)
- Poll health endpoints (60s, 2s interval):
  - `http://localhost:8555/health` (celery-insights)
  - `http://localhost:8000/scenarios` (interactive API)

### 4. `frontend/e2e/global-teardown.ts`
- Skip if `E2E_SKIP_COMPOSE=1`
- `docker compose down -v --remove-orphans`

### 5. `frontend/e2e/helpers/scenario-client.ts`
HTTP client wrapping interactive API (`http://localhost:8000`):
- `triggerScenario(name)` → `POST /scenarios/{name}` → `{ scenario, task_id }`
- `triggerAll()` → `POST /all` → `Record<string, string>`
- `triggerBurst(count)` → `POST /burst?count=N` → `{ task_ids }`
- `revokeTask(taskId, terminate?)` → `POST /revoke/{taskId}`

### 6. `frontend/e2e/helpers/docker-compose.ts`
Thin wrappers around `execSync` for compose up/down, with configurable path and timeouts.

### 7. `frontend/e2e/fixtures/base.ts`
Extended Playwright `test` fixture providing:
- `scenario` — the scenario client
- `waitForTask(taskId, states[], opts?)` — polls `GET /api/tasks/{taskId}` on celery-insights (:8555) until task reaches desired state. Core anti-flakiness pattern.
- `waitForTaskVisible(taskId)` — polls until task exists in celery-insights

### 8. Test files (11 specs, ~35 tests total)

**`navigation.spec.ts`** (3 tests)
- Sidebar links: Dashboard → Explorer → Live Events → Settings
- `/nonexistent` → "404 Not Found" + "Back Home" link
- Deep-link `/tasks/{id}` loads task detail

**`dashboard.spec.ts`** (4 tests)
- "Online Workers" heading, at least one worker card
- Trigger `add` → wait SUCCESS → "tasks.basic.add" in recent tasks (`#recent-tasks`)
- Trigger `always_fails` → wait FAILURE → exception info in ExceptionsSummary
- Click task → navigates to `/tasks/{id}`

**`task-detail.spec.ts`** (5 tests)
- Trigger `add` → `/tasks/{id}` → header shows type + task ID
- `#workflow-chart` visible
- `#lifetime-chart` visible
- `#task-details` grid visible
- Unknown ID → "Could not find this task"

**`task-failures.spec.ts`** (4 tests)
- `always_fails` → "RuntimeError" + "This task always fails"
- `division_by_zero` → "ZeroDivisionError"
- `deep_traceback` → "ValueError"
- `retry_backoff` → FAILURE (30s timeout) → retry info visible

**`task-canvas.spec.ts`** (3 tests)
- `chain` → `.react-flow__node` elements in `#workflow-chart`
- `chord` → SUCCESS (30s), workflow chart visible
- `link_error` → FAILURE, workflow chart visible

**`worker-detail.spec.ts`** (3 tests)
- Dashboard → worker link → `#worker-details` with "Hostname"
- `#worker-pool` + `#registered-tasks` with "tasks.basic" entries
- Unknown worker → "Could not find worker"

**`explorer.spec.ts`** (3 tests)
- Pre-trigger scenarios → `/explorer` → table has rows
- `#facets-menu` with "State" and "Type"
- "N Tasks found" count label

**`raw-events.spec.ts`** (2 tests)
- Trigger `noop` → table rows appear in `/raw_events`
- "N Events" counter with non-zero count

**`search.spec.ts`** (3 tests)
- `#search-bar` visible in header
- Trigger `noop` → type "noop" → "tasks.basic.noop" in results popover
- Nonsense query → "no tasks or workers matching"

**`settings.spec.ts`** (3 tests)
- "Theme", "Demo mode", "Show welcome banner" controls
- "Hostname" + "Python Version" in Server Info
- "Debug Bundle" button visible

**`realtime.spec.ts`** (2 tests)
- WS indicator shows "Connected"
- Trigger `noop` → task appears in `#recent-tasks` without refresh (`toPass` polling)

### 9. `.github/workflows/e2e.yml`
```yaml
name: E2E Tests
on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
concurrency:
  group: e2e-${{ github.ref }}
  cancel-in-progress: true
jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
        working-directory: frontend
      - run: bunx playwright install --with-deps chromium
        working-directory: frontend
      - run: bun run e2e
        working-directory: frontend
        env: { CI: "true" }
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: playwright-report, path: frontend/e2e/playwright-report/ }
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-traces, path: frontend/e2e/test-results/ }
      - if: always()
        run: docker compose -f test_project/docker-compose.yml --profile interactive down -v --remove-orphans || true
```

### 10. `.gitignore` additions
```
# Playwright
frontend/e2e/test-results/
frontend/e2e/playwright-report/
```

## Anti-Flakiness Strategy

1. **API-level waiting**: Poll `GET /api/tasks/{id}` before DOM assertions — separates Celery processing time from rendering time
2. **`expect().toPass()`**: For dynamic DOM content (e.g., task count increased), use Playwright's polling assertion
3. **Generous timeouts**: 10s default, 30s for retry/chord. Never unbounded
4. **CI retries**: `retries: 2` handles container CPU contention
5. **Task ID isolation**: Each test uses its own `task_id` — never assert global counts
6. **Deterministic scenarios only**: Use `always_fails`/`add`/`noop` — never `random_failure`

## Verified Selectors (from source)

| Selector | Source | Line |
|----------|--------|------|
| `#recent-tasks` | `routes/index.tsx` | 46 |
| `#workflow-chart` | `routes/tasks.$taskId.tsx` | 33 |
| `#lifetime-chart` | `routes/tasks.$taskId.tsx` | 41 |
| `#task-details` | `routes/tasks.$taskId.tsx` | 45 |
| `#worker-details` | `routes/workers.$workerId.tsx` | 35 |
| `#worker-pool` | `routes/workers.$workerId.tsx` | 41 |
| `#registered-tasks` | `routes/workers.$workerId.tsx` | 56 |
| `#facets-menu` | `routes/explorer.tsx` | 23 |
| `#search-bar` | `components/search/search-box.tsx` | 16 |
| "Connected" | `components/common/ws-state-icon.tsx` | 13 |
| "404 Not Found" | `routes/__root.tsx` | 54 |
| "Back Home" | `routes/__root.tsx` | 57 |
| "Could not find this task" | `routes/tasks.$taskId.tsx` | 26 |
| "Could not find worker" | `routes/workers.$workerId.tsx` | 27 |
| "no tasks or workers matching" | `components/search/search-result-list.tsx` | 59 |
| "Online Workers" | `components/worker/workers-summary-stack.tsx` | 11 |
| "N Tasks found" | `routes/explorer.tsx` | 30 |
| "N Events" | `routes/raw_events.tsx` | 49 |

## Verification

```bash
# Local (stack already running):
cd test_project && docker compose --profile interactive up --build -d
cd ../frontend
E2E_SKIP_COMPOSE=1 bun run e2e          # All tests
E2E_SKIP_COMPOSE=1 bun run e2e:headed   # Watch in browser
E2E_SKIP_COMPOSE=1 bun run e2e:ui       # Playwright UI mode

# Full lifecycle (matches CI):
cd frontend && bun run e2e               # compose up → tests → compose down
```
