import react from "@vitejs/plugin-react"
import tsConfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

export default defineConfig({
    plugins: [tsConfigPaths({ projects: ["./tsconfig.json"] }), react()],
    test: {
        globals: true,
        environment: "happy-dom",
        include: ["app/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
        css: false,
        setupFiles: ["./vitest.setup.ts"],
    },
})
