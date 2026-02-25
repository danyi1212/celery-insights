/**
 * Custom Bun entry point for production.
 * Orchestrates SurrealDB subprocess, leader election, Python ingester spawning,
 * serves static SPA files, and proxies API/WS/SurrealDB requests.
 *
 * Usage: bun run bun-entry.ts
 * (after building with `bun run build`)
 */
import path from "node:path"
import { spawn, type ChildProcess } from "node:child_process"
import Surreal from "surrealdb"
import { config } from "./src/config"
import { LeaderElection, generateInstanceId, type IngestionStatus } from "./src/leader-election"
import { runSchemaMigration } from "./src/surreal-schema"

const PYTHON_PORT = 8556
const PYTHON_BACKEND = `http://localhost:${PYTHON_PORT}`
const PYTHON_WS_BACKEND = `ws://localhost:${PYTHON_PORT}`
const DIST_DIR = path.resolve(import.meta.dir, "dist")

// Read index.html once at startup for SPA fallback
const indexHtml = Bun.file(path.join(DIST_DIR, "index.html"))

let surrealProcess: ChildProcess | null = null
let pythonProcess: ChildProcess | null = null
let leaderElection: LeaderElection | null = null
let ingestionStatus: IngestionStatus = "disabled"
let shuttingDown = false
const instanceId = generateInstanceId()
const managingSurrealDB = !config.surrealdbExternalUrl

// --- SurrealDB subprocess management ---

const SURREAL_BACKOFF_BASE_MS = 1000
const SURREAL_BACKOFF_MAX_MS = 30000
let surrealRestartAttempts = 0

function spawnSurrealDB(): ChildProcess {
    console.log(
        `Spawning SurrealDB subprocess on port ${config.surrealdbPort} (storage: ${config.surrealdbStorage})`,
    )
    const proc = spawn(
        "surreal",
        ["start", "--bind", `0.0.0.0:${config.surrealdbPort}`, "--user", "root", "--pass", "root", config.surrealdbStorage],
        { stdio: "inherit" },
    )

    proc.on("exit", (code) => {
        if (shuttingDown) return
        console.error(`SurrealDB exited with code ${code}`)
        surrealProcess = null

        const backoffMs = Math.min(SURREAL_BACKOFF_BASE_MS * 2 ** surrealRestartAttempts, SURREAL_BACKOFF_MAX_MS)
        surrealRestartAttempts++
        console.log(`Restarting SurrealDB in ${backoffMs}ms (attempt ${surrealRestartAttempts})`)
        setTimeout(() => {
            if (!shuttingDown) {
                surrealProcess = spawnSurrealDB()
            }
        }, backoffMs)
    })

    return proc
}

/**
 * Wait for SurrealDB to accept HTTP connections before proceeding.
 * Polls the health endpoint with exponential backoff.
 */
async function waitForSurrealDB(maxWaitMs = 30000): Promise<void> {
    const surrealHttpUrl = config.surrealdbExternalUrl
        ? config.surrealdbExternalUrl.replace(/\/rpc$/, "")
        : `http://localhost:${config.surrealdbPort}`
    const healthUrl = `${surrealHttpUrl}/health`
    const startTime = Date.now()
    let delayMs = 200

    while (Date.now() - startTime < maxWaitMs) {
        try {
            const res = await fetch(healthUrl)
            if (res.ok) {
                surrealRestartAttempts = 0
                console.log("SurrealDB is ready")
                return
            }
        } catch {
            // Not ready yet
        }
        await Bun.sleep(delayMs)
        delayMs = Math.min(delayMs * 1.5, 2000)
    }
    throw new Error(`SurrealDB did not become ready within ${maxWaitMs}ms`)
}

// --- Python subprocess management ---

function spawnPython(): ChildProcess {
    console.log("Spawning Python ingester subprocess")
    const proc = spawn("python", ["run.py"], {
        cwd: path.resolve(import.meta.dir, "server"),
        env: {
            ...process.env,
            PORT: String(PYTHON_PORT),
            SURREALDB_URL: config.surrealdbUrl,
            SURREALDB_INGESTER_PASS: config.surrealdbIngesterPass,
            SURREALDB_NAMESPACE: config.surrealdbNamespace,
            SURREALDB_DATABASE: config.surrealdbDatabase,
            BROKER_URL: config.brokerUrl,
            RESULT_BACKEND: config.resultBackend,
            CONFIG_FILE: config.configFile,
            TIMEZONE: config.timezone,
            DEBUG: String(config.debug),
            CLEANUP_INTERVAL_SECONDS: String(config.cleanupIntervalSeconds),
            TASK_MAX_COUNT: config.taskMaxCount != null ? String(config.taskMaxCount) : "",
            TASK_RETENTION_HOURS: config.taskRetentionHours != null ? String(config.taskRetentionHours) : "",
            DEAD_WORKER_RETENTION_HOURS:
                config.deadWorkerRetentionHours != null ? String(config.deadWorkerRetentionHours) : "",
            INGESTION_BATCH_INTERVAL_MS: String(config.ingestionBatchIntervalMs),
        },
        stdio: "inherit",
    })

    proc.on("exit", (code) => {
        if (shuttingDown) return
        console.error(`Python ingester exited with code ${code}`)
        // If we're still leader, restart Python
        if (leaderElection?.isLeader) {
            console.log("Restarting Python ingester (leader still holds lock)")
            pythonProcess = spawnPython()
        }
    })

    return proc
}

// --- Signal handling ---

async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`Received ${signal} — shutting down`)

    // 1. Release ingestion lock (if held)
    if (leaderElection) {
        await leaderElection.stop()
    }

    // 2. Kill Python subprocess (if running)
    if (pythonProcess) {
        pythonProcess.kill(signal === "SIGTERM" ? "SIGTERM" : "SIGINT")
    }

    // 3. Kill SurrealDB subprocess (if managed)
    if (surrealProcess) {
        surrealProcess.kill("SIGTERM")
    }

    process.exit(0)
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))

// --- Startup sequence ---

// 1. Start SurrealDB subprocess (or skip if external URL is set)
if (managingSurrealDB) {
    surrealProcess = spawnSurrealDB()
} else {
    console.log(`Using external SurrealDB at ${config.surrealdbExternalUrl}`)
}

// 2. Wait for SurrealDB to be ready
await waitForSurrealDB()

// 3. Run schema migration (as root — creates namespace, database, tables, ingester user)
await runSchemaMigration(config)

// 4. Connect to SurrealDB as ingester user
const db = new Surreal()
const surrealdbBaseUrl = config.surrealdbUrl.replace(/\/rpc$/, "")

try {
    await db.connect(config.surrealdbUrl, {
        namespace: config.surrealdbNamespace,
        database: config.surrealdbDatabase,
        authentication: {
            namespace: config.surrealdbNamespace,
            database: config.surrealdbDatabase,
            username: "ingester",
            password: config.surrealdbIngesterPass,
        },
    })
    console.log("Connected to SurrealDB")
} catch (err) {
    console.error("Failed to connect to SurrealDB:", err)
    process.exit(1)
}

// 5. Run leader election (spawns Python if this instance becomes leader)
leaderElection = new LeaderElection({
    db,
    config,
    instanceId,
    onBecomeLeader() {
        pythonProcess = spawnPython()
    },
    onLoseLeadership() {
        if (pythonProcess) {
            console.log("Lost leadership — stopping Python ingester")
            pythonProcess.kill("SIGTERM")
            pythonProcess = null
        }
    },
})

ingestionStatus = await leaderElection.start()

// 6. Start serving
const server = Bun.serve({
    port: config.port,
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

        // Bun-served endpoint: frontend configuration
        if (url.pathname === "/api/config") {
            return Response.json({
                authRequired: config.surrealdbFrontendPass != null,
                surrealPath: "/surreal/rpc",
                ingestionStatus: leaderElection?.status ?? ingestionStatus,
            })
        }

        // Bun-served endpoint: health check (always available)
        if (url.pathname === "/health") {
            return Response.json({
                status: "ok",
                ingestionStatus: leaderElection?.status ?? ingestionStatus,
                surrealdb: managingSurrealDB
                    ? surrealProcess
                        ? "running"
                        : "stopped"
                    : "external",
                python: pythonProcess ? "running" : "not running",
            })
        }

        // Proxy /surreal/* to SurrealDB (always active — frontend data access)
        if (url.pathname.startsWith("/surreal/")) {
            const surrealPath = url.pathname.replace(/^\/surreal/, "")
            const targetUrl = `${surrealdbBaseUrl}${surrealPath}${url.search}`

            // Handle WebSocket upgrade for SurrealDB RPC
            if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
                const success = server.upgrade(req, {
                    data: { targetPath: url.pathname + url.search, isSurreal: true },
                })
                if (success) return undefined
                return new Response("SurrealDB WebSocket upgrade failed", { status: 500 })
            }

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
                return new Response("SurrealDB unavailable", { status: 502 })
            }
        }

        // Proxy API, docs, etc. to Python backend (only if Python is running)
        if (
            url.pathname.startsWith("/api") ||
            url.pathname === "/docs" ||
            url.pathname === "/redoc" ||
            url.pathname === "/openapi.json"
        ) {
            if (!pythonProcess) {
                return new Response("Backend not available (ingestion not active on this instance)", { status: 503 })
            }

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
            const data = ws.data as { targetPath: string; isSurreal?: boolean }

            if (data.isSurreal) {
                // Proxy to SurrealDB
                const surrealWsUrl = config.surrealdbUrl.replace(/^http/, "ws")
                const backendWs = new WebSocket(surrealWsUrl)

                backendWs.onopen = () => {
                    // @ts-expect-error attach backend ws for message relay
                    ws._backendWs = backendWs
                }

                backendWs.onmessage = (event) => {
                    ws.send(event.data as string)
                }

                backendWs.onclose = () => ws.close()
                backendWs.onerror = () => ws.close()
                return
            }

            // Proxy to Python backend
            const targetUrl = `${PYTHON_WS_BACKEND}${data.targetPath}`
            const backendWs = new WebSocket(targetUrl)

            backendWs.onopen = () => {
                // @ts-expect-error attach backend ws for message relay
                ws._backendWs = backendWs
            }

            backendWs.onmessage = (event) => {
                ws.send(event.data as string)
            }

            backendWs.onclose = () => ws.close()
            backendWs.onerror = () => ws.close()
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
console.log(`SurrealDB: ${managingSurrealDB ? `managed (port ${config.surrealdbPort}, storage: ${config.surrealdbStorage})` : `external (${config.surrealdbExternalUrl})`}`)
console.log(`Ingestion status: ${leaderElection?.status ?? ingestionStatus}`)
