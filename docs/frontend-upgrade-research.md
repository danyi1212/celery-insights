# Frontend upgrade research

Snapshot: 2026-10-02. Baseline versions are from the pre-upgrade package manifest, including packages brought in by the main-branch synchronization. Latest versions were checked with `bun outdated` against npm, plus `bun info` for unchanged packages. “Latest” uses the npm `latest` dist-tag; the JSON viewer already uses an alpha release. This is a planning inventory, not evidence that the upgrades passed validation.

## Complete direct dependency inventory

| Package | Baseline constraint | Latest | Risk / review focus |
| --- | --- | --- | --- |
| `@floating-ui/react` | `^0.27.19` | `0.27.20` | Low: same release line; standard build/tests and UI parity |
| `@mdx-js/react` | `^3.1.1` | `3.1.1` | Current latest: retain and validate with updated peers |
| `@surrealdb/wasm` | `^3.0.3` | `3.0.3` | Medium: pair with supported SurrealDB SDK/server |
| `@tailwindcss/vite` | `^4.2.1` | `4.3.3` | Low: same release line; standard build/tests and UI parity |
| `@tanstack/react-hotkeys` | `^0.4.1` | `0.12.1` | Medium: normalization API and key/code types; shortcut parity |
| `@tanstack/react-query` | `^5.90.21` | `5.104.0` | Low: same release line; standard build/tests and UI parity |
| `@tanstack/react-router` | `^1.167.1` | `1.170.41` | Low: same release line; standard build/tests and UI parity |
| `@tanstack/react-table` | `^8.21.3` | `9.2.4` | High: separate Table v9 API refactor |
| `@uiw/react-json-view` | `^2.0.0-alpha.41` | `2.0.0-alpha.43` | Medium: already opted into alpha; inspect JSON view |
| `@vercel/analytics` | `^2.0.1` | `2.0.1` | Current latest: retain and validate with updated peers |
| `@xyflow/react` | `^12.10.1` | `12.12.0` | Low: same release line; standard build/tests and UI parity |
| `class-variance-authority` | `^0.7.1` | `0.7.1` | Current latest: retain and validate with updated peers |
| `clsx` | `^2.1.1` | `2.1.1` | Current latest: retain and validate with updated peers |
| `date-fns` | `^4.1.0` | `4.4.0` | Low: same release line; standard build/tests and UI parity |
| `html-to-image` | `^1.11.13` | `1.11.13` | Current latest: retain and validate with updated peers |
| `lucide-react` | `^0.577.0` | `1.49.0` | Medium: remove Github brand import; icon parity |
| `minidenticons` | `^4.2.1` | `4.2.1` | Current latest: retain and validate with updated peers |
| `motion` | `^12.36.0` | `13.5.0` | Low/medium: prop forwarding change; animation sanity |
| `nuqs` | `^2.10.1` | `2.10.1` | Current latest: retain; query string parity |
| `@danyi1212/time-range-picker` | `^0.1.1` | `0.1.1` | Current latest: retain; time range interaction parity |
| `@testing-library/dom` | Added peer dependency | `10.4.2` | Required direct peer of jest-dom 7; use latest patch |
| `radix-ui` | `^1.4.3` | `1.6.7` | Low: same release line; standard build/tests and UI parity |
| `react` | `^19.2.4` | `19.3.0` | Low/medium: component and interaction parity |
| `react-dom` | `^19.2.4` | `19.3.0` | Low/medium: update together with React |
| `react-joyride` | `^2.9.3` | `3.2.0` | High: separate guided tour v3 refactor |
| `react-shiki` | `^0.9.2` | `0.11.1` | Medium: default CSS layer changed; code block visual parity |
| `react-transition-group` | `^4.4.5` | `4.4.5` | Current latest: retain and validate with updated peers |
| `recharts` | `^3.8.0` | `3.10.1` | Low: same release line; standard build/tests and UI parity |
| `rehype-slug` | `^6.0.0` | `6.0.0` | Current latest: retain and validate with updated peers |
| `remark-gfm` | `^4.0.1` | `4.0.1` | Current latest: retain and validate with updated peers |
| `semver` | `^7.7.4` | `7.8.5` | Low: same release line; standard build/tests and UI parity |
| `shiki` | `^4.0.2` | `4.5.0` | Low: same release line; standard build/tests and UI parity |
| `string-to-color` | `^2.2.2` | `2.2.2` | Current latest: retain and validate with updated peers |
| `surrealdb` | `^2.0.2` | `2.0.9` | Medium: check server/SDK/WASM alignment and live query parity |
| `tailwind-merge` | `^3.5.0` | `3.7.0` | Low: same release line; standard build/tests and UI parity |
| `tailwindcss` | `^4.2.1` | `4.3.3` | Low: same release line; standard build/tests and UI parity |
| `tailwindcss-animate` | `^1.0.7` | `1.0.7` | Current latest: retain and validate with updated peers |
| `uuid` | `^13.0.0` | `14.0.2` | Low: global crypto required; check unused dependency |
| `zod` | `^3.25.76` | `4.6.5` | Medium: defaults/coercion/error semantics; config parity |
| `zustand` | `^5.0.11` | `5.0.15` | Low: same release line; standard build/tests and UI parity |
| `@playwright/test` | `^1.58.2` | `1.63.0` | Low/medium: refresh browser binaries and image pin |
| `@tanstack/router-plugin` | `^1.166.10` | `1.168.42` | Low: same release line; standard build/tests and UI parity |
| `@testing-library/jest-dom` | `^6.9.1` | `7.0.1` | Medium: Node 22+, direct @testing-library/dom peer |
| `@testing-library/react` | `^16.3.2` | `16.3.3` | Low: same release line; standard build/tests and UI parity |
| `@testing-library/user-event` | `^14.6.1` | `14.6.7` | Low: same release line; standard build/tests and UI parity |
| `@types/react` | `^19.2.14` | `19.3.0` | Low: same release line; standard build/tests and UI parity |
| `@types/react-dom` | `^19.2.3` | `19.3.0` | Low: same release line; standard build/tests and UI parity |
| `@types/react-transition-group` | `^4.4.12` | `4.4.12` | Current latest: retain and validate with updated peers |
| `@types/semver` | `^7.7.1` | `7.8.0` | Low: same release line; standard build/tests and UI parity |
| `@types/uuid` | `^11.0.0` | `11.0.0` | Remove: deprecated stub; uuid supplies types |
| `@mdx-js/rollup` | `^3.1.1` | `3.1.1` | Current latest: retain and validate with updated peers |
| `@vitejs/plugin-react` | `^6.0.1` | `6.1.1` | Low/medium: build and React compiler peer compatibility |
| `concurrently` | `^9.2.1` | `10.0.5` | Low: Node 22+, ESM; plain CLI remains compatible |
| `happy-dom` | `^20.8.4` | `20.14.5` | Low: same release line; standard build/tests and UI parity |
| `oxfmt` | `^0.40.0` | `0.71.0` | Medium: pre-1.0 formatting changes; avoid unrelated churn |
| `oxlint` | `^1.55.0` | `1.86.0` | Low: same release line; standard build/tests and UI parity |
| `typescript` | `^5.9.3` | `7.0.2` | Medium: native compiler, removed baseUrl; path config and peer API compatibility |
| `vite` | `^8.0.0` | `8.3.2` | Low/medium: build and Bun runtime integration |
| `vitest` | `^4.1.0` | `5.0.3` | Medium: Node 22.12+, mocks clear automatically |

## Major refactors to isolate

- **TanStack Table 9.2.4:** migrate `explorer-grid.tsx` to `useTable`, explicit features and row model slots, updated feature-aware types and state access. Use native v9 APIs; the temporary legacy hook is deprecated. Verify selection, pagination, visible columns, empty states, and comparison interactions. [Official migration guide](https://tanstack.com/table/latest/docs/framework/react/guide/migrating).
- **React Joyride 3.2.0:** refactor `joyride-tour.tsx` and the custom `tour-tooltip.tsx`. Named imports, event controls, shared options, button configuration, renamed step fields and Floating UI replace the old API. Verify all 14 steps, route-driven advancement, previous/skip/finish, missing targets and demo cleanup. [Official migration guide](https://react-joyride.com/docs/migration).

## Changes suitable for the combined upgrade PR

- **TypeScript 7.0.2:** the native compiler is stable. Remove deprecated `baseUrl`, prefix relative path targets with `./`, retain explicit strict/types/bundler configuration, and validate the alias loader. Packages consuming the old TypeScript JavaScript API can require the TypeScript 6 alias; inspect peer tooling rather than assuming compatibility. [Release announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), [6.0 migration notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html).
- **Vitest 5.0.3:** requires Vite >=6.4 and Node >=22.12. Mock call histories now clear before each test; confirm tests do not depend on calls recorded outside test bodies. Vite is already direct. Validate happy-dom setup and Bun execution. [Official migration guide](https://vitest.dev/guide/migration/).
- **Zod 4.6.5:** default values short-circuit parsing, optional-property defaults are applied more broadly, coercion inputs become unknown, error APIs change, integer bounds tighten. The two imports are runtime configuration and task comparison search validation. Exercise default environment values, booleans, invalid ports, URL overrides and omitted query params. [Official migration guide](https://zod.dev/v4/changelog).
- **Lucide 1.49.0:** brand icons were removed. `src/layout/header/header.tsx` currently imports `Github`; replace it with a local SVG preserving the accessible link and appearance. [Official React migration guide](https://lucide.dev/guide/react/migration).
- **Hotkeys 0.12.1:** normalization/display APIs changed in 0.8, key/code union types and layout handling changed in 0.11, and 0.12 packages are ESM targeting ES2022 with Node >=20. The installed 0.12.1 package still exports `rawHotkeyToParsedHotkey` (confirmed by a Bun import), so no mandatory normalization rename was found. Validate the existing wrapper with sequences, input suppression, modifiers and dialog display. [Official changelog](https://github.com/TanStack/hotkeys/blob/main/packages/react-hotkeys/CHANGELOG.md).
- **Motion 13.5.0:** automatic Emotion prop validation becomes explicit injection. No Emotion/styled-components usage was found in the manifest, so a large refactor is not expected; validate transitions and console output. [Official React upgrade guide](https://motion.dev/docs/react-upgrade-guide).
- **react-shiki 0.11.1:** default CSS becomes unlayered, so layered Tailwind padding/radius overrides may lose precedence. Verify `code-block.tsx` rendering, light/dark themes, overflow and language fallback. [Official changelog](https://github.com/AVGVSTVS96/react-shiki/blob/main/package/CHANGELOG.md).
- **jest-dom 7.0.1:** Node >=22 and `@testing-library/dom` is a required peer. Declare the peer explicitly for reproducible installs and verify Vitest matcher types. [Official releases](https://github.com/testing-library/jest-dom/releases).
- **concurrently 10.0.5:** Node >=22, ESM-only, automatic prefix colors, removed deprecated flags/API options. The project uses the plain CLI without removed options. [Official releases](https://github.com/open-cli-tools/concurrently/releases).
- **uuid 14.0.2:** global crypto and Node >=20 are required. No source imports were found; remove unused uuid and its deprecated `@types/uuid` stub if that remains true after repository-wide inspection. [Official releases](https://github.com/uuidjs/uuid/releases), [type package metadata](https://registry.npmjs.org/@types%2Fuuid/latest).

## Node and CI tooling

- **Node 26.10.0** is the latest Current release; **24.21.0** is the latest LTS. Set Node explicitly for Vitest/Playwright tooling; the local 22.3.0 installation is below the Vitest 5 minimum of 22.12.0. Passing tests on that old installation does not establish supported-runtime parity. For the latest-version goal use 26.10.0 in CI; consider a latest-LTS matrix entry. [Official Node releases](https://nodejs.org/en/about/previous-releases).
- **actions/setup-node v7.0.0** is the latest official action release. It migrates internals to ESM, updates dependencies, adds cache-key outputs, and removes dummy authentication-token export. Keep the action runtime separate from the `node-version` input that selects project tooling Node. [Official release](https://github.com/actions/setup-node/releases/tag/v7.0.0).

## Validation gates

Run a frozen lockfile installation, frontend typecheck/lint/format/unit tests, production build, runtime tests, and Playwright parity smoke tests. Browser binaries must match Playwright 1.63.0. Verify the Explorer, task comparison, worker views, workflow/timeline charts, keyboard shortcuts, JSON/code output, guided tour and demo mode. Confirm actual CI Node/Bun versions satisfy engine requirements; local Bun success alone does not prove Node tooling compatibility. Complete server/SDK/WASM integration and container smoke testing before release.
