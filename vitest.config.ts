import { defineConfig } from "vitest/config"
import { loadTsconfigAliases } from "./tooling/tsconfig-aliases"

export default defineConfig({
  resolve: {
    alias: loadTsconfigAliases(),
  },
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}", "runtime/**/*.test.{ts,tsx}"],
    css: false,
    setupFiles: ["./vitest.setup.ts"],
  },
})
