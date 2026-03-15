import { defineConfig } from "../tooling/playwright"
import type { ReporterDescription } from "@playwright/test"

const isCI = !!process.env.CI
const e2eHost = process.env.E2E_HOST ?? "127.0.0.1"
const e2eSuite = process.env.E2E_SUITE ?? "all"
const e2eReportMode = process.env.E2E_REPORT_MODE ?? "default"
const e2eBlobOutputDir = process.env.E2E_BLOB_OUTPUT_DIR

const serialTests = [
  /dashboard\.spec\.ts$/,
  /explorer\.spec\.ts$/,
  /metrics\.spec\.ts$/,
  /raw-events\.spec\.ts$/,
  /realtime\.spec\.ts$/,
  /search\.spec\.ts$/,
]

const parallelSafeTests = [
  /documentation\.spec\.ts$/,
  /navigation\.spec\.ts$/,
  /settings\.spec\.ts$/,
  /task-canvas\.spec\.ts$/,
  /task-detail\.spec\.ts$/,
  /task-failures\.spec\.ts$/,
  /worker-detail\.spec\.ts$/,
]

const testMatch = e2eSuite === "parallel-safe" ? parallelSafeTests : e2eSuite === "serial" ? serialTests : undefined

const fullyParallel = e2eSuite === "parallel-safe"
const workers = e2eSuite === "parallel-safe" ? 2 : 1
const reporter: ReporterDescription[] =
  e2eReportMode === "blob"
    ? e2eBlobOutputDir
      ? [["blob", { outputDir: e2eBlobOutputDir }]]
      : [["blob"]]
    : isCI
      ? [
          ["github"],
          ["html", { outputFolder: "../playwright-report" }],
          ["junit", { outputFile: "../playwright-report/results.xml" }],
        ]
      : [["html", { outputFolder: "../playwright-report" }]]

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
  outputDir: "../test-results/playwright",
  fullyParallel,
  workers,
  testMatch,
  retries: isCI ? 2 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter,
  use: {
    baseURL: `http://${e2eHost}:8555`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
})
