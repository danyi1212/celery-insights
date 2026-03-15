import { defineConfig } from "../tooling/playwright"

const isCI = !!process.env.CI

export default defineConfig({
  reporter: isCI
    ? [
        ["github"],
        ["html", { outputFolder: "../playwright-report" }],
        ["junit", { outputFile: "../playwright-report/results.xml" }],
      ]
    : [["html", { outputFolder: "../playwright-report" }]],
})
