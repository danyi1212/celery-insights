import { defineConfig } from "@playwright/test"

const isCI = !!process.env.CI
const e2eHost = process.env.E2E_HOST ?? "127.0.0.1"

export default defineConfig({
    testDir: "./tests",
    globalSetup: "./global-setup.ts",
    globalTeardown: "./global-teardown.ts",
    fullyParallel: false,
    workers: 1,
    retries: isCI ? 2 : 0,
    timeout: 30_000,
    expect: { timeout: 10_000 },
    reporter: isCI
        ? [["github"], ["html", { outputFolder: "playwright-report" }], ["junit", { outputFile: "playwright-report/results.xml" }]]
        : [["html", { outputFolder: "playwright-report" }]],
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
