import { defineConfig } from "../tooling/playwright"

export default defineConfig({
  reporter: [["json", { outputFile: "../playwright-report/results.json" }]],
})
