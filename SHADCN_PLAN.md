# Migration Plan: MUI → Shadcn UI + Tailwind CSS

## Context

Celery Insights frontend currently uses MUI v5 (88 files, 405+ imports) with Emotion CSS-in-JS. The goal is to modernize the entire frontend stack:

- **MUI v5** → **Shadcn UI + Tailwind CSS v4**
- **React 18** → **React 19**
- **Emotion/styled** → **Tailwind utility classes**
- **@mui/icons-material** → **Lucide React**
- **@mui/x-data-grid** → **TanStack Table + Shadcn Table**
- **reactflow v11** → **@xyflow/react v12**
- Update all TanStack libraries to latest versions

The migration preserves all product features and the green/orange color identity while adopting Shadcn's vanilla design language.

---

## 1. Stack Upgrade Summary

| Current | Target | Notes |
|---------|--------|-------|
| React 18.3 | React 19.1 | Remove forwardRef usage, refs as props |
| MUI v5.16 | Shadcn UI (latest) | Copy-paste component model |
| Emotion CSS-in-JS | Tailwind CSS v4 | CSS-first config, no JS config |
| @mui/icons-material | Lucide React | 1:1 icon mapping (34 icons) |
| @mui/x-data-grid v6 | TanStack Table v8 + Shadcn Table | Headless + composable |
| reactflow v11 | @xyflow/react v12 | Named exports, dark mode support |
| ApexCharts | **Tremor** (Recharts wrapper) + ApexCharts for Gantt | See chart section |
| react-joyride | **TBD** (Onborda or keep joyride) | See decisions section |
| @textea/json-viewer | **TBD** (@uiw/react-json-view) | See decisions section |
| react-syntax-highlighter | **TBD** (Shiki or prism-react-renderer) | See decisions section |
| Zustand 4.x | Zustand 5.x | Ensure "use" prefix on hooks for React Compiler |

---

## 2. MUI → Shadcn Component Mapping

### Direct Replacements (1:1 mapping)

| MUI Component | Shadcn Equivalent | Files Affected |
|---------------|-------------------|----------------|
| `Button` | `Button` | 18+ files |
| `IconButton` | `Button variant="ghost" size="icon"` | 19+ files |
| `Alert` + `AlertTitle` | `Alert` + `AlertTitle` + `AlertDescription` | 6+ files |
| `Tooltip` | `Tooltip` (Radix-based) | 30+ files |
| `Badge` | `Badge` | 3+ files |
| `Avatar` | `Avatar` | 6+ files |
| `Skeleton` | `Skeleton` | 4+ files |
| `Chip` | `Badge` (variant) | 2 files |
| `Popover` | `Popover` | 1 file |
| `Switch` | `Switch` | 2 files |
| `Checkbox` | `Checkbox` | 1 file |
| `Select` + `MenuItem` | `Select` | 1 file |
| `TextField` | `Input` | 1 file |
| `Divider` | `Separator` | 7+ files |
| `Card`/`CardContent`/`CardActions` | `Card`/`CardContent`/`CardHeader`/`CardFooter` | 2 files |
| `LinearProgress` | `Progress` | 2 files |
| `CircularProgress` | `Spinner` (custom or Lucide `Loader2`) | 6+ files |
| `Toggle`/`ToggleButtonGroup` | `Toggle`/`ToggleGroup` | 2 files |
| `Collapse` | `Collapsible` (Radix) | 13+ files |

### Layout Replacements (MUI → Tailwind)

| MUI Component | Tailwind Equivalent | Notes |
|---------------|-------------------|-------|
| `Box` | `<div className="...">` | 43+ files, most common replacement |
| `Stack` | `<div className="flex flex-col gap-*">` | 19+ files |
| `Grid` | `<div className="grid grid-cols-*">` | 8+ files |
| `Paper` | `<div className="rounded-lg border bg-card">` | 3+ files |
| `Typography` | Native HTML elements + Tailwind text classes | 45+ files |
| `Toolbar` | `<div className="flex items-center gap-*">` | 6+ files |
| `List`/`ListItem`/etc. | Native HTML `<ul>`/`<li>` + Tailwind | 11+ files |

### Complex Replacements

| MUI Component | Shadcn/Solution | Migration Notes |
|---------------|-----------------|-----------------|
| `AppBar` + `useScrollTrigger` | Custom header + CSS `translate-y` transition | Replace `Slide` with Tailwind transform |
| `Drawer` (styled, collapsible) | `Sidebar` (Shadcn) | Full feature parity: icon-only collapse, mobile Sheet overlay, keyboard shortcut |
| `DataGrid` | TanStack Table + Shadcn `Table` | Faceted filtering via `getFacetedUniqueValues()` |
| `LoadingButton` (@mui/lab) | `Button` + `Loader2` icon | Conditional spinner child |
| `AvatarGroup` | Custom flex layout with overlapping Avatars | `flex -space-x-2` pattern |
| `Zoom` transition | `tailwindcss-animate` (`animate-in zoom-in-75 fade-in`) | CSS-only, 0 runtime cost |
| `Slide` transition | Tailwind `translate-y` + `transition-transform` | CSS-only |
| `styled()` components (8 files) | Tailwind utility classes + `cn()` helper | Eliminate Emotion entirely |
| `sx` prop (69 usages) | Tailwind classes | Inline style → className |
| `useTheme()` | CSS variables + `useTheme` from next-themes | 11+ files |
| `useMediaQuery()` | Tailwind responsive prefixes or custom hook | 5+ files |

---

## 3. Icon Mapping: @mui/icons-material → Lucide React

34 unique MUI icons mapped to Lucide equivalents:

| MUI Icon | Lucide Icon |
|----------|-------------|
| ArrowBackIos / ArrowBackIosNew | `ArrowLeft` |
| ArrowForwardIos / ArrowForward | `ArrowRight` |
| CheckCircle / CheckCircleOutline | `CheckCircle2` / `CheckCircle` |
| Error / ErrorOutline | `AlertCircle` |
| Cancel / HighlightOff | `X` / `XCircle` |
| PlayCircle | `PlayCircle` |
| WatchLater / Pending | `Clock` |
| ExpandMore / KeyboardArrowDown | `ChevronDown` |
| ExpandLess / KeyboardArrowUp | `ChevronUp` |
| Search | `Search` |
| Close | `X` |
| Refresh | `RotateCw` |
| Settings | `Settings` |
| GitHub | `Github` |
| Download | `Download` |
| Lock / LockOpen | `Lock` / `LockOpen` |
| Brightness2 / BrightnessHigh / BrightnessAuto | `Moon` / `Sun` / `Monitor` |
| SignalWifi* (5 variants) | `Wifi` / `WifiOff` |
| AccountTree | `GitBranch` |
| ViewTimeline | `GanttChart` or `Calendar` |
| SpaceDashboardOutlined | `LayoutDashboard` |
| RssFeed | `Rss` |
| ManageSearch | `Search` |
| ZoomIn / ZoomOut / ZoomOutMap | `ZoomIn` / `ZoomOut` / `Maximize2` |
| PanTool | `Move` |
| Camera / CenterFocusStrong | `Camera` / `Focus` |
| Link | `Link` |
| HelpOutline | `HelpCircle` |
| Alarm / Schedule | `AlarmClock` / `Clock` |
| ReadMore | `ChevronRight` |
| ClearAll | `ListX` |
| NotificationsOff | `BellOff` |
| OfflineBolt | `Zap` |
| RemoveCircle | `MinusCircle` |
| ChangeCircle | `RotateCw` |

---

## 4. Charts Strategy

### Tremor for standard charts

Tremor provides Shadcn/Tailwind-styled chart components wrapping Recharts. Suitable for any future standard charts (bar, line, area, pie, radar).

### ApexCharts for Gantt/Timeline (KEEP)

**Critical limitation**: Neither Recharts nor Tremor support `rangeBar` (Gantt/timeline) charts. Your two chart components both use this:

- `TaskLifetimeChart.tsx` — horizontal rangeBar showing task state durations
- `TimelineChart.tsx` — horizontal rangeBar with zoom/pan/click for workflow timeline

**Recommendation**: Keep ApexCharts **only** for these 2 components. They have minimal MUI dependency (just `useTheme` for colors and `Box` wrapper) — easy to decouple.

---

## 5. Tailwind CSS v4 + Shadcn Setup

### Installation

```bash
bun add tailwindcss @tailwindcss/vite
bunx shadcn@latest init
```

### Vite config

```ts
// vite.config.ts
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),  // Must come first
    tanstackStart(),
    tsConfigPaths(),
  ]
})
```

### CSS config (replaces tailwind.config.js)

```css
/* app/styles.css */
@import "tailwindcss";

@theme {
  --color-primary: oklch(0.78 0.16 105);        /* #a9cc54 green */
  --color-primary-foreground: oklch(0.15 0.02 105);
  --color-secondary: oklch(0.62 0.12 55);       /* #c4783d orange */
  --color-secondary-foreground: oklch(0.98 0.01 55);
}

:root {
  --background: oklch(0.87 0.04 105);           /* #dee5ce light bg */
  --card: oklch(0.96 0.02 105);                 /* #f5f8ee light paper */
}
.dark {
  --background: oklch(0.10 0.01 155);           /* #141716 dark bg */
  --card: oklch(0.11 0.01 155);                 /* #161918 dark paper */
}
```

### SSR integration (TanStack Start)

```tsx
// __root.tsx
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
})
```

### Dark mode

- Class-based: `<html class="dark">` toggled via settings store
- System preference detection preserved from `usePreferredTheme`
- Replace MUI's `ThemeProvider` with a simple className toggle

---

## 6. Theme Migration

### Current MUI theme → Tailwind CSS variables

| MUI Token | CSS Variable | Value |
|-----------|-------------|-------|
| `palette.primary.main` | `--color-primary` | `#a9cc54` (green) |
| `palette.secondary.main` | `--color-secondary` | `#c4783d` (orange) |
| `palette.background.default` (dark) | `--background` (dark) | `#141716` |
| `palette.background.paper` (dark) | `--card` (dark) | `#161918` |
| `palette.background.default` (light) | `--background` (light) | `#dee5ce` |
| `palette.background.paper` (light) | `--card` (light) | `#f5f8ee` |
| `darkScrollbar()` | Tailwind `scrollbar-*` utilities or custom CSS | Dark scrollbar in dark mode |
| `theme.spacing(n)` | Tailwind spacing scale (`p-2`, `m-4`, etc.) | Standard 4px base |
| `theme.breakpoints.up("sm")` | Tailwind `sm:` prefix | 640px |
| `theme.transitions.create()` | Tailwind `transition-*` classes | CSS transitions |

---

## 7. Decisions (Finalized)

- **Gantt/Timeline Charts**: Keep ApexCharts for now. Designer will provide a custom Gantt component later — skip migration of `TaskLifetimeChart.tsx` and `TimelineChart.tsx`.
- **Tour Library**: Keep `react-joyride`, restyle `TourTooltip.tsx` with Shadcn `Card`/`Button` components. Lowest risk.
- **JSON Viewer**: `@uiw/react-json-view` — zero deps, built-in themes, near-identical API to current `@textea/json-viewer`.
- **Syntax Highlighter**: `Shiki` + `react-shiki` — VS Code-quality highlighting, works with SSR via TanStack Start.

---

## 8. Implementation Plan (Phased Migration)

### Phase 0: Foundation Setup (non-breaking)

**Goal**: Set up Tailwind + Shadcn alongside MUI so both work simultaneously.

- [x] Install Tailwind CSS v4 + `@tailwindcss/vite` plugin
- [x] Create `app/styles.css` with theme CSS variables (colors from current theme.ts)
- [x] Configure `vite.config.ts` with Tailwind plugin
- [x] Run `bunx shadcn@latest init` — creates `components.json` + `lib/utils.ts` (cn helper)
- [x] Install `lucide-react`
- [x] Install Shadcn base components: `button`, `tooltip`, `badge`, `alert`, `skeleton`, `separator`, `card`, `avatar`, `switch`, `checkbox`, `input`, `select`, `progress`, `toggle`, `toggle-group`, `collapsible`, `popover`, `table`, `sidebar`, `sheet`, `scroll-area`
- [x] Update `__root.tsx` to load `styles.css` via `?url` for SSR
- [x] Set up dark mode class toggle (replace `ThemeProvider`)
- [x] Upgrade React to 19.1, update TanStack libs to latest
- [x] Upgrade `reactflow` → `@xyflow/react` v12

**Files created/modified**:

- `frontend/app/styles.css` (new)
- `frontend/app/components/ui/` (new — Shadcn components)
- `frontend/app/lib/utils.ts` (new — `cn()` helper)
- `frontend/components.json` (new)
- `frontend/vite.config.ts` (add Tailwind plugin)
- `frontend/package.json` (new deps, remove MUI deps at end)
- `frontend/app/routes/__root.tsx` (CSS loading)

**Verification**: App runs with both MUI and Tailwind active. No visual changes yet.

---

### Phase 1: Core Layout (Sidebar + Header)

**Goal**: Replace the shell — Menu drawer and Header AppBar.

- [x] **Sidebar**: Replace MUI `Drawer` in `Menu.tsx` with Shadcn `Sidebar` (`collapsible="icon"` mode, port menu items/worker status, wrap root in `SidebarProvider`, remove Zustand `menuExpanded`)
- [x] **Header**: Replace MUI `AppBar` in `Header.tsx` with Tailwind-styled header (CSS translate-y, port SearchBox/ThemeSelector/NotificationBadge, replace icons with Lucide)

**Files modified**: `Menu.tsx`, `MenuItem.tsx`, `Header.tsx`, `SearchBox.tsx`, `ThemeSelector.tsx`, `NotificationBadge.tsx`, `__root.tsx` (layout restructure)

**Verification**: Navigation works, sidebar collapses, search works, theme switching works.

---

### Phase 2: Common Components

**Goal**: Migrate the shared component library used across all pages.

- [x] `Panel.tsx` / `PanelPaper.tsx` → Shadcn `Card` with Tailwind
- [x] `AnimatedList.tsx` / `AnimatedListItem.tsx` → native `<ul>`/`<li>` + Tailwind transitions
- [x] `CodeBlock.tsx` → new syntax highlighter (Shiki or prism-react-renderer)
- [x] `CopyLinkButton.tsx` → Shadcn `Button` + Lucide `Link` + `Copy` icons
- [x] `DetailItem.tsx` → remove `styled()`, use Tailwind classes
- [x] `DistanceTimer.tsx` → replace MUI `Typography` with Tailwind text
- [x] `IdentityIcon.tsx` → minimal changes (SVG-based)
- [x] `LinearProgressWithLabel.tsx` → Shadcn `Progress`
- [x] `ListSkeleton.tsx` → Shadcn `Skeleton`
- [x] `WsStateIcon.tsx` → Lucide WiFi icons
- [x] Error alert components (5 files) → Shadcn `Alert`

**Files modified**: 16 files in `components/common/` and `components/errors/`

**Verification**: All common components render correctly in both dark/light modes.

---

### Phase 3: Page-by-Page Migration

- [x] **3a. Home Page** (`index.tsx`): Migrate `WelcomeBanner`, `BannerFlowchart`, `RecentTasksPanel`, `WorkersSummaryStack`, `WorkerQuickStatusList`, `WorkerQuickStatus`, `DemoSimulator`, `CeleryStateSync`
- [x] **3b. Task Detail Page** (`tasks.$taskId.tsx`): Migrate `TaskPageHeader`, `TaskAvatar`, `TaskStatusIcon`, `TaskTimer`, `TaskLifetimeChart`, alert components, card components
- [x] **3c. Worker Detail Page** (`workers.$workerId.tsx`): Migrate `WorkerSummary`, `WorkerStatus`, panel components (6 files), task sub-panels (7 files)
- [x] **3d. Explorer Page** (`explorer.tsx`): Migrate `ExplorerGrid` to TanStack Table + Shadcn Table, `ExplorerLayout`, facet components
- [x] **3e. Raw Events Page** (`raw_events.tsx`): Migrate `RawEventsTable`, `RawEventRow`, `LimitSelect`, `ToggleConnect`
- [x] **3f. Settings Page** (`settings.tsx`): Migrate `SettingsPanel`, `ServerInfoPanel`, `OnlineClientsPanel`, `ClientInfoItem`, `ClientConnectionStatus`, `DownloadDebugBundleButton`, `VersionCheckIcon`
- [x] **3g. Workflow Components**: Migrate `FlowChart`, `TaskNode`, `TimelineChart`, `WorkflowGraph` (update @xyflow/react imports)
- [x] **3h. Search Components**: Migrate `SearchResultList`, `SearchResultListItem`

**Verification per page**: Each page renders correctly, all interactions work, dark/light mode works.

---

### Phase 4: Tour Restyling

- [x] Restyle `TourTooltip.tsx` with Shadcn `Card`/`Button`, Tailwind classes, `tailwindcss-animate` for Zoom replacement. Test full tour flow.

---

### Phase 5: Cleanup & Finalization

- [ ] **Remove MUI**: Uninstall `@mui/material`, `@mui/icons-material`, `@mui/lab`, `@mui/x-data-grid`, `@emotion/react`, `@emotion/styled`
- [ ] **Delete `theme.ts`**: All theming now in CSS variables
- [ ] **Remove `ConsolidatedProviders.tsx`**: No more `ThemeProvider`/`CssBaseline`
- [ ] **Update `usePreferredTheme.ts`**: Simplify to toggle `.dark` class on `<html>`
- [ ] **Update CLAUDE.md**: Reflect new stack and conventions
- [ ] **Run full lint + type check**: `bun run lint-fix && bunx tsc --noEmit`
- [ ] **Visual regression test**: Compare every page in dark/light mode

**Final verification**:

- `bun run build` succeeds
- `bun run start` serves the app correctly
- All pages render, all interactions work
- Dark/light mode toggle works
- WebSocket events flow correctly
- Explorer filtering/sorting works
- Tour completes all steps
- No MUI packages in `node_modules`

---

## 9. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Visual regression | Screenshot each page before/after, compare |
| SSR breaks | Test `bun run build && bun run start` after each phase |
| Bundle size increase | Monitor with `bun build --metafile` |
| Transition UX loss | Use `tailwindcss-animate` for entrance/exit animations |
| DataGrid feature loss | TanStack Table supports all used features (sort, filter, custom cells) |
| React 19 breaks | Update early (Phase 0), fix issues before component migration |

---

## 10. Dependencies to Add/Remove

### Add

```
react@^19.1  react-dom@^19.1
tailwindcss  @tailwindcss/vite  tailwindcss-animate
lucide-react
@xyflow/react@^12
@tanstack/react-table@^8
@uiw/react-json-view
shiki  react-shiki
@tremor/react (for future chart needs)
```

### Remove (at end of Phase 5)

```
@mui/material  @mui/icons-material  @mui/lab  @mui/x-data-grid
@emotion/react  @emotion/styled
reactflow (replaced by @xyflow/react)
@textea/json-viewer
react-syntax-highlighter
```

### Keep

```
apexcharts  react-apexcharts (Gantt charts — pending designer input)
react-joyride (restyled with Shadcn)
```
