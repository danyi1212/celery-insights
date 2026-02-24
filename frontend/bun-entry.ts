/**
 * Custom Bun entry point for production.
 * Spawns the Python backend, serves static SPA files, and proxies API/WS to Python.
 *
 * Usage: bun run bun-entry.ts
 * (after building with `bun run build`)
 */
import path from "node:path"
import { spawn } from "node:child_process"

const PYTHON_PORT = 8556
const PYTHON_BACKEND = `http://localhost:${PYTHON_PORT}`
const PYTHON_WS_BACKEND = `ws://localhost:${PYTHON_PORT}`
const PORT = parseInt(process.env.PORT || "8555", 10)
const DIST_DIR = path.resolve(import.meta.dir, "dist")

// Read index.html once at startup for SPA fallback
const indexHtml = Bun.file(path.join(DIST_DIR, "index.html"))

// Spawn Python backend as a child process
const python = spawn("python", ["run.py"], {
    cwd: path.resolve(import.meta.dir, "server"),
    env: { ...process.env, PORT: String(PYTHON_PORT) },
    stdio: "inherit",
})

python.on("exit", (code) => {
    console.error(`Python backend exited with code ${code}`)
    process.exit(code ?? 1)
})

process.on("SIGTERM", () => {
    python.kill("SIGTERM")
    process.exit(0)
})

process.on("SIGINT", () => {
    python.kill("SIGINT")
    process.exit(0)
})

const server = Bun.serve({
    port: PORT,
    async fetch(req, server) {
        const url = new URL(req.url)

        // Handle WebSocket upgrade requests for /ws/* paths
        if (url.pathname.startsWith("/ws") && req.headers.get("upgrade")?.toLowerCase() === "websocket") {
            const success = server.upgrade(req, {
                data: { targetPath: url.pathname + url.search },
            })
            if (success) return undefined
            return new Response("WebSocket upgrade failed", { status: 500 })
        }

        // Proxy API, health, docs, etc. to Python backend
        if (
            url.pathname.startsWith("/api") ||
            url.pathname === "/health" ||
            url.pathname === "/docs" ||
            url.pathname === "/redoc" ||
            url.pathname === "/openapi.json"
        ) {
            const targetUrl = `${PYTHON_BACKEND}${url.pathname}${url.search}`
            try {
                const proxyRes = await fetch(targetUrl, {
                    method: req.method,
                    headers: req.headers,
                    body: req.body,
                })
                return new Response(proxyRes.body, {
                    status: proxyRes.status,
                    statusText: proxyRes.statusText,
                    headers: proxyRes.headers,
                })
            } catch {
                return new Response("Backend unavailable", { status: 502 })
            }
        }

        // Serve static assets (JS/CSS bundles, SVGs, fonts, images)
        if (url.pathname.startsWith("/assets/") || url.pathname.match(/\.(svg|png|ico|jpg|css|js|woff2?|ttf|map)$/)) {
            const filePath = path.resolve(DIST_DIR, "." + url.pathname)
            if (!filePath.startsWith(DIST_DIR)) return new Response("Forbidden", { status: 403 })
            const file = Bun.file(filePath)
            if (await file.exists()) {
                return new Response(file, {
                    headers: {
                        "Cache-Control": url.pathname.startsWith("/assets/")
                            ? "public, max-age=31536000, immutable"
                            : "public, max-age=3600",
                    },
                })
            }
        }

        // SPA fallback — serve index.html for all other routes
        return new Response(indexHtml, {
            headers: { "Content-Type": "text/html" },
        })
    },
    websocket: {
        open(ws) {
            const { targetPath } = ws.data as { targetPath: string }
            const targetUrl = `${PYTHON_WS_BACKEND}${targetPath}`

            const backendWs = new WebSocket(targetUrl)

            backendWs.onopen = () => {
                // @ts-expect-error attach backend ws for message relay
                ws._backendWs = backendWs
            }

            backendWs.onmessage = (event) => {
                ws.send(event.data as string)
            }

            backendWs.onclose = () => {
                ws.close()
            }

            backendWs.onerror = () => {
                ws.close()
            }
        },
        message(ws, message) {
            // @ts-expect-error relay messages to backend
            const backendWs = ws._backendWs as WebSocket | undefined
            if (backendWs && backendWs.readyState === WebSocket.OPEN) {
                backendWs.send(message)
            }
        },
        close(ws) {
            // @ts-expect-error clean up backend ws
            const backendWs = ws._backendWs as WebSocket | undefined
            if (backendWs && backendWs.readyState === WebSocket.OPEN) {
                backendWs.close()
            }
        },
    },
})

console.log(`Celery Insights running at http://localhost:${server.port}`)
