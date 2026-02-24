import { defineConfig } from "vite"
import tailwindcss from "@tailwindcss/vite"
import tsConfigPaths from "vite-tsconfig-paths"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
    plugins: [
        tailwindcss(),
        tsConfigPaths({ projects: ["./tsconfig.json"] }),
        TanStackRouterVite({
            routesDirectory: "app/routes",
            generatedRouteTree: "app/routeTree.gen.ts",
            autoCodeSplitting: true,
        }),
        react({
            jsxImportSource: "@emotion/react",
        }),
    ],
    define: {
        // react-joyrider uses the global object, even though it doesn't exist in the browser.
        // https://github.com/vitejs/vite/discussions/5912
        // https://github.com/bevacqua/dragula/issues/602#issuecomment-1296313369
        global: "window",
    },
    optimizeDeps: {
        include: [
            "@emotion/react",
            "@emotion/styled",
            "@emotion/react/jsx-runtime",
            "@mui/material",
            "@mui/system",
            "@mui/material/styles",
        ],
    },
    server: {
        port: 3000,
        proxy: {
            "/api": {
                target: "http://localhost:8555",
                changeOrigin: true,
                secure: false,
            },
            "/ws": {
                target: "ws://localhost:8555",
                changeOrigin: true,
                secure: false,
                ws: true,
            },
            "/docs": {
                target: "http://localhost:8555",
                changeOrigin: true,
                secure: false,
            },
            "/redoc": {
                target: "http://localhost:8555",
                changeOrigin: true,
                secure: false,
            },
            "/openapi.json": {
                target: "http://localhost:8555",
                changeOrigin: true,
                secure: false,
            },
            "/health": {
                target: "http://localhost:8555",
                changeOrigin: true,
                secure: false,
            },
        },
    },
})
