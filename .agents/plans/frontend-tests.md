# Frontend Unit & Component Testing Plan

## Context

The frontend currently has **zero testing infrastructure** — no test runner, no testing libraries, no test files. The backend already follows a colocated `_test.py` convention. This plan sets up Vitest + Testing Library and writes tests for the most critical utilities, stores, components, and hooks — prioritized by value (pure logic first, then components).

---

## Phase 1: Infrastructure Setup

- [x] 1.1 Install dependencies (`bun add -d vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event happy-dom`)
- [x] 1.2 Create `frontend/vitest.config.ts` — Separate from `vite.config.ts`. Plugins: `vite-tsconfig-paths` + `@vitejs/plugin-react`. Environment: `happy-dom` (jsdom 28 has ESM compat issues). Globals: `true`. Include: `app/**/*_test.{ts,tsx}`. CSS: `false`. Setup file: `./vitest.setup.ts`.
- [x] 1.3 Create `frontend/vitest.setup.ts` — Import `@testing-library/jest-dom/vitest`, `afterEach(() => cleanup())`, polyfill `ResizeObserver`
- [x] 1.4 Update `frontend/tsconfig.json` — Add `"types": ["vitest/globals"]` to `compilerOptions`
- [x] 1.5 Update `frontend/package.json` — Add scripts: `"test": "vitest run"`, `"test:watch": "vitest"`
- [x] 1.6 Create shared test helpers — `app/test-utils.tsx` (custom `render()` with `TooltipProvider`) and `app/test-fixtures.ts` (factory functions: `createServerTask()`, `createStateTask()`, `createServerWorker()`, `createTaskEventMessage()`, `createWorkerEventMessage()`)

---

## Phase 2: Tier 1 — Pure Utility Tests (highest ROI, no mocking)

- [ ] 2.1 `app/lib/utils_test.ts` (~6 tests) — Merges class strings, handles conditionals via clsx, resolves Tailwind conflicts via twMerge, handles undefined/null/empty inputs
- [ ] 2.2 `app/utils/color-utils_test.ts` (~6 tests) — getBrightness: white=100, black=0, pure red/green/blue correct values, uppercase hex handling
- [ ] 2.3 `app/utils/translate-server-models_test.ts` (~8 tests) — translateTask: Unix timestamp → Date, null → undefined, snake_case → camelCase, children array preserved; translateWorker: timestamps, camelCase mapping, cpuLoad tuple
- [ ] 2.4 `app/utils/task-phases_test.ts` (~20 tests) — isTerminalState (all 9 states), getTaskEndTime (terminal timestamps, priority, fallback), computeTaskPhases (3-phase, single phase, zero-duration, running, skipped worker wait, revoked fallbacks), formatDuration (ms/seconds/minutes, 0ms, boundaries), formatTime (default vs detailed, zero-padding)

---

## Phase 3: Tier 2 — Zustand Store Tests

- [ ] 3.1 `app/stores/use-state-store_test.ts` (~10 tests) — handleEvent task (adds new, adds to recentTaskIds, no duplicates, caps at capacity, updates existing), handleEvent worker (adds/updates), resetState (clears all), direct store testing via getState()/setState()
- [ ] 3.2 `app/stores/use-settings-store_test.ts` (~4 tests) — Default values, resetSettings restores defaults, useIsDefaultSettings hook, clear localStorage in beforeEach
- [ ] 3.3 `app/stores/use-explorer-config_test.ts` (~5 tests) — Default column/facet orders, useExplorerColumns returns visible columns in order, useExplorerFacets excludes noFacet columns

---

## Phase 4: Tier 3 — Component Tests

- [ ] 4.1 `app/components/task/task-status-icon_test.tsx` (~10 tests) — Parameterized: all 9 states → correct color class and tooltip text, className/iconClassName passthrough
- [ ] 4.2 `app/components/task/task-avatar_test.tsx` (~7 tests) — Link to `/tasks/{taskId}` vs div when `disableLink`, background color from type, status badge, mock `@tanstack/react-router` Link
- [ ] 4.3 `app/components/task/task-timer_test.tsx` (~6 tests) — Returns null when no eta/expires, ETA countdown, expiry warning colors, expired state, mock `useNow`
- [ ] 4.4 `app/components/workflow/flow-chart_test.ts` (~8 tests) — Pure function `getFlowGraph` only: single node, parent-child edges, vertical centering, child sorting, cycle detection, missing root, deep trees
- [ ] 4.5 `app/components/task/task-lifetime-chart_test.tsx` (~7 tests) — Empty phases message, 3 phase segments, live indicator, total duration header, legend toggle, mock `useNow`
- [ ] 4.6 `app/components/explorer/facet_test.tsx` (~8 tests) — Title rendered, values sorted by count desc, selection add/remove, clear all, search filtering, custom valueFormatter

---

## Phase 5: Tier 4 — Hook Tests

- [ ] 5.1 `app/hooks/use-now_test.ts` (~5 tests) — Returns current date initially, updates at specified interval, no updates without interval, clears on unmount, restarts on interval change, uses `vi.useFakeTimers()`

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
