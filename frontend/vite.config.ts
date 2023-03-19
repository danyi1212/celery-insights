import react from "@vitejs/plugin-react-swc"
import {defineConfig} from "vite"
import eslint from "vite-plugin-eslint"
import tsconfigPaths from "vite-tsconfig-paths"

// https://vitejs.dev/config/
// noinspection JSUnusedGlobalSymbols
export default defineConfig({
    plugins: [eslint(), tsconfigPaths(), react()],
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
