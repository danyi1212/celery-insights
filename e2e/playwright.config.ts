import { defineConfig } from "../tooling/playwright"

import { appBaseURL, urlPrefix } from "./helpers/app-url"

const isCI = !!process.env.CI

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
  outputDir: "../test-results/playwright",
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 2 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: isCI
    ? [
        ["github"],
        ["html", { outputFolder: "../playwright-report" }],
        ["json", { outputFile: "../playwright-report/results.json" }],
        ["junit", { outputFile: "../playwright-report/results.xml" }],
      ]
    : [["html", { outputFolder: "../playwright-report" }]],
  use: {
    baseURL: appBaseURL,
    ignoreHTTPSErrors: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      ...(urlPrefix ? { testMatch: "**/reverse-proxy.spec.ts" } : { testIgnore: "**/reverse-proxy.spec.ts" }),
      use: { browserName: "chromium" },
    },
  ],
})
