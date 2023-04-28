import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"
import viteCompression from "vite-plugin-compression"
import eslint from "vite-plugin-eslint"
import tsconfigPaths from "vite-tsconfig-paths"

// https://vitejs.dev/config/
// noinspection JSUnusedGlobalSymbols
export default defineConfig({
    plugins: [eslint(), tsconfigPaths(), react(), viteCompression()],
    define: {
        // react-joyrider uses the global object, even though it doesn't exist in the browser.
        // https://github.com/vitejs/vite/discussions/5912
        // https://github.com/bevacqua/dragula/issues/602#issuecomment-1296313369
        global: "window",
    },
    server: {
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
        },
    },
})
