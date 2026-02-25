# Frontend Unit & Component Testing Plan

## Context

The frontend currently has **zero testing infrastructure** — no test runner, no testing libraries, no test files. The backend already follows a colocated `_test.py` convention. This plan sets up Vitest + Testing Library and writes tests for the most critical utilities, stores, components, and hooks — prioritized by value (pure logic first, then components).

---

## Phase 1: Infrastructure Setup

### 1.1 Install dependencies

```bash
bun add -d vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

### 1.2 Create `frontend/vitest.config.ts`

Separate from `vite.config.ts` to avoid TanStack Router plugin, Tailwind compilation, and the `global: "window"` define that would break jsdom.

- Plugins: `vite-tsconfig-paths` (for `@*` aliases) + `@vitejs/plugin-react`
- Environment: `jsdom`
- Globals: `true` (no need to import `describe`/`it`/`expect`)
- Include pattern: `app/**/*_test.{ts,tsx}` (matching CONTRIBUTING.md `_test` suffix convention)
- CSS: `false` (skip Tailwind processing for speed)
- Setup file: `./vitest.setup.ts`

### 1.3 Create `frontend/vitest.setup.ts`

- Import `@testing-library/jest-dom/vitest` (adds `toBeInTheDocument()` etc.)
- `afterEach(() => cleanup())` for React Testing Library
- Polyfill `ResizeObserver` (not in jsdom)

### 1.4 Update `frontend/tsconfig.json`

Add `"types": ["vitest/globals"]` to `compilerOptions`.

### 1.5 Update `frontend/package.json`

Add scripts: `"test": "vitest run"`, `"test:watch": "vitest"`

### 1.6 Create shared test helpers

- **`app/test-utils.tsx`** — Custom `render()` wrapping components in `TooltipProvider` (required by Radix tooltips)
- **`app/test-fixtures.ts`** — Factory functions: `createServerTask()`, `createStateTask()`, `createServerWorker()`, `createTaskEventMessage()`, `createWorkerEventMessage()`

---

## Phase 2: Tier 1 — Pure Utility Tests (highest ROI, no mocking)

### `app/lib/utils_test.ts` (~6 tests)
- Merges class strings, handles conditionals via clsx, resolves Tailwind conflicts via twMerge, handles undefined/null/empty inputs

### `app/utils/color-utils_test.ts` (~6 tests)
- getBrightness: white=100, black=0, pure red/green/blue correct values, uppercase hex handling

### `app/utils/translate-server-models_test.ts` (~8 tests)
- translateTask: Unix timestamp (seconds) → Date conversion, null → undefined, snake_case → camelCase, children array preserved
- translateWorker: timestamps, camelCase mapping, cpuLoad tuple

### `app/utils/task-phases_test.ts` (~20 tests) — **most valuable test file**
- `isTerminalState`: all 9 TaskState values
- `getTaskEndTime`: each terminal timestamp, priority order, fallback to `now`
- `computeTaskPhases`: full 3-phase task, single phase (only sentAt), zero-duration phases, running task (uses `now`), skipped worker wait, revoked-before-start fallbacks
- `formatDuration`: ms/seconds/minutes ranges, 0ms, exact boundaries
- `formatTime`: default vs detailed format, zero-padding

---

## Phase 3: Tier 2 — Zustand Store Tests

### `app/stores/use-state-store_test.ts` (~10 tests)
- `handleEvent` (task): adds new task, adds to recentTaskIds, no duplicate IDs, caps at capacity, updates existing task
- `handleEvent` (worker): adds/updates workers
- `resetState`: clears tasks, workers, recentTaskIds
- Direct store testing via `getState()`/`setState()`, real LRUCache instances

### `app/stores/use-settings-store_test.ts` (~4 tests)
- Default values, resetSettings restores defaults, useIsDefaultSettings hook
- Clear localStorage in beforeEach

### `app/stores/use-explorer-config_test.ts` (~5 tests)
- Default column/facet orders, useExplorerColumns returns visible columns in order, useExplorerFacets excludes noFacet columns

---

## Phase 4: Tier 3 — Component Tests

### `app/components/task/task-status-icon_test.tsx` (~10 tests)
- Parameterized: all 9 states → correct color class and tooltip text
- className/iconClassName passthrough

### `app/components/task/task-avatar_test.tsx` (~7 tests)
- Link to `/tasks/{taskId}` vs div when `disableLink`
- Background color from type via string-to-color, no color when type undefined
- Status badge presence/absence
- Mock: `@tanstack/react-router` Link → `<a>`

### `app/components/task/task-timer_test.tsx` (~6 tests)
- Returns null when no eta/expires
- ETA countdown when future, expiry warning (yellow >5min, red <5min), expired state
- ETA prioritized over expires
- Mock: `useNow` returns fixed date

### `app/components/workflow/flow-chart_test.ts` (~8 tests)
- **Pure function `getFlowGraph` only** (no full FlowChart rendering)
- Single node, parent-child edges, vertical centering, child sorting, cycle detection (replaced nodes), missing root → empty, deep trees, initialPosition offset

### `app/components/task/task-lifetime-chart_test.tsx` (~7 tests)
- Empty phases → "No lifecycle data" message
- 3 phase segments for completed task
- Live indicator for non-terminal states, hidden for terminal
- Total duration in header, legend visibility toggle
- Mock: `useNow` returns fixed date

### `app/components/explorer/facet_test.tsx` (~8 tests)
- Title rendered, values sorted by count desc
- Selection add/remove via click, clear all
- Search filtering (case-insensitive)
- Custom valueFormatter

---

## Phase 5: Tier 4 — Hook Tests

### `app/hooks/use-now_test.ts` (~5 tests)
- Returns current date initially, updates at specified interval, no updates without interval
- Clears interval on unmount, restarts on interval change
- Uses `vi.useFakeTimers()`

---

## Files to Create/Modify

**New files (19):**
- `frontend/vitest.config.ts`
- `frontend/vitest.setup.ts`
- `frontend/app/test-utils.tsx`
- `frontend/app/test-fixtures.ts`
- `frontend/app/lib/utils_test.ts`
- `frontend/app/utils/color-utils_test.ts`
- `frontend/app/utils/translate-server-models_test.ts`
- `frontend/app/utils/task-phases_test.ts`
- `frontend/app/stores/use-state-store_test.ts`
- `frontend/app/stores/use-settings-store_test.ts`
- `frontend/app/stores/use-explorer-config_test.ts`
- `frontend/app/components/task/task-status-icon_test.tsx`
- `frontend/app/components/task/task-avatar_test.tsx`
- `frontend/app/components/task/task-timer_test.tsx`
- `frontend/app/components/workflow/flow-chart_test.ts`
- `frontend/app/components/task/task-lifetime-chart_test.tsx`
- `frontend/app/components/explorer/facet_test.tsx`
- `frontend/app/hooks/use-now_test.ts`

**Modified files (2):**
- `frontend/tsconfig.json` — add `"types": ["vitest/globals"]`
- `frontend/package.json` — add test scripts

## Verification

```bash
cd frontend && bun run test
```

All ~110 tests should pass. Run `bun run lint` to ensure no lint issues in test files.
