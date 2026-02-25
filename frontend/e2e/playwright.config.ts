import { defineConfig } from "@playwright/test"

const isCI = !!process.env.CI

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
        baseURL: "http://localhost:8555",
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
