/**
 * Custom Bun entry point for production.
 * Orchestrates SurrealDB subprocess, leader election, Python ingester spawning,
 * serves static SPA files and proxies API/WS requests to Python.
 *
 * Usage: bun run bun-entry.ts
 * (after building with `bun run build`)
 */
import path from "node:path"
import readline from "node:readline"
import { spawn, type ChildProcess } from "node:child_process"
import { Surreal } from "surrealdb"
import { config, type Config } from "./src/config"
import {
    createDebugBundleArchive,
    exportSurrealNative,
    getSnapshotDetails,
    getSnapshotSummary,
    getSurrealRecordCounts,
    importSurrealNative,
    importSurrealData,
    LineRingBuffer,
    parseDebugSnapshot,
    type DebugBundleClientInfo,
    type ParsedDebugSnapshot,
} from "./src/debug-bundle"
import { bunLogger, registerLogSink, surrealLogger } from "./src/logger"
import { LeaderElection, generateInstanceId, type IngestionStatus } from "./src/leader-election"
import { runSchemaMigration } from "./src/surreal-schema"

const LOGO = `
  ░██████             ░██                                ░██████                      ░██           ░██           ░██
 ░██   ░██            ░██                                  ░██                                      ░██           ░██
░██         ░███████  ░██  ░███████  ░██░████ ░██    ░██   ░██  ░████████   ░███████  ░██ ░████████ ░████████  ░████████  ░███████
░██        ░██    ░██ ░██ ░██    ░██ ░███     ░██    ░██   ░██  ░██    ░██ ░██        ░██░██    ░██ ░██    ░██    ░██    ░██
░██        ░█████████ ░██ ░█████████ ░██      ░██    ░██   ░██  ░██    ░██  ░███████  ░██░██    ░██ ░██    ░██    ░██     ░███████
 ░██   ░██ ░██        ░██ ░██        ░██      ░██   ░███   ░██  ░██    ░██        ░██ ░██░██   ░███ ░██    ░██    ░██           ░██
  ░██████   ░███████  ░██  ░███████  ░██       ░█████░██ ░██████░██    ░██  ░███████  ░██ ░█████░██ ░██    ░██     ░████  ░███████
                                                     ░██                                        ░██
                                               ░███████                                   ░███████

`.trim();


// --- Startup banner ---

function printBanner(runtimeConfig: Config, replaySnapshot: ParsedDebugSnapshot | null): void {
    if (runtimeConfig.logFormat !== "pretty") return

    const isTTY = process.stdout.isTTY === true
    const c = isTTY
        ? { reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m", green: "\x1b[32m" }
        : { reset: "", dim: "", bold: "", green: "" }

    const logo = `${c.green}${c.bold}${LOGO}${c.reset}\n`

    const surrealInfo = runtimeConfig.surrealdbExternalUrl
        ? `external (${runtimeConfig.surrealdbExternalUrl})`
        : `managed (${runtimeConfig.surrealdbStorage}) on port ${runtimeConfig.surrealdbPort}`

    const ingestionInfo = replaySnapshot
        ? "snapshot replay (read-only)"
        : !runtimeConfig.ingestionEnabled
          ? "disabled"
          : runtimeConfig.ingestionLeaderElection
          ? "enabled (leader election)"
          : "enabled (standalone)"

    const retention: string[] = []
    if (runtimeConfig.taskMaxCount != null) retention.push(`max ${runtimeConfig.taskMaxCount} tasks`)
    if (runtimeConfig.taskRetentionHours != null) retention.push(`tasks: ${runtimeConfig.taskRetentionHours}h`)
    if (runtimeConfig.deadWorkerRetentionHours != null) retention.push(`dead workers: ${runtimeConfig.deadWorkerRetentionHours}h`)

    const lines = [
        `  ${c.dim}Server${c.reset}      http://localhost:${runtimeConfig.port}`,
        `  ${c.dim}Broker${c.reset}      ${runtimeConfig.brokerUrl}`,
        `  ${c.dim}Backend${c.reset}     ${runtimeConfig.resultBackend}`,
        `  ${c.dim}SurrealDB${c.reset}   ${surrealInfo}`,
        `  ${c.dim}Ingestion${c.reset}   ${ingestionInfo}`,
        `  ${c.dim}Log level${c.reset}   ${runtimeConfig.logLevel}`,
    ]

    if (retention.length > 0) {
        lines.push(`  ${c.dim}Retention${c.reset}   ${retention.join(", ")}`)
    }
    if (runtimeConfig.timezone !== "UTC") {
        lines.push(`  ${c.dim}Timezone${c.reset}    ${runtimeConfig.timezone}`)
    }
    if (runtimeConfig.debug) {
        lines.push(`  ${c.dim}Debug${c.reset}       enabled`)
    }
    if (replaySnapshot) {
        lines.push(`  ${c.dim}Snapshot${c.reset}    ${replaySnapshot.bundlePath}`)
    }

    process.stdout.write(logo + lines.join("\n") + "\n\n")
}

const PYTHON_PORT = 8556
const PYTHON_BACKEND = `http://localhost:${PYTHON_PORT}`
const PYTHON_WS_BACKEND = `ws://localhost:${PYTHON_PORT}`

// Derive SurrealDB proxy targets from config (strip /rpc suffix, convert ws->http)
const DIST_DIR = path.resolve(import.meta.dir, "dist")

// Read index.html once at startup for SPA fallback
const indexHtml = Bun.file(path.join(DIST_DIR, "index.html"))

let surrealProcess: ChildProcess | null = null
let pythonProcess: ChildProcess | null = null
let leaderElection: LeaderElection | null = null
let ingestionStatus: IngestionStatus = "disabled"
let shuttingDown = false
const instanceId = generateInstanceId()
let replaySnapshot: ParsedDebugSnapshot | null = null
let runtimeConfig: Config = config
const bunLogBuffer = new LineRingBuffer()
const surrealLogBuffer = new LineRingBuffer()
const pythonLogBuffer = new LineRingBuffer()
registerLogSink("bun", (line) => bunLogBuffer.add(line))
registerLogSink("surrealdb", (line) => surrealLogBuffer.add(line))

const REQUEST_HOP_BY_HOP_HEADERS = new Set([
    "connection",
    "content-length",
    "host",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
])

const RESPONSE_HOP_BY_HOP_HEADERS = new Set([
    "connection",
    "content-encoding",
    "content-length",
    "keep-alive",
    "transfer-encoding",
])

function getSurrealBases(activeConfig: Config): { httpBase: string; wsBase: string } {
    const wsBase = activeConfig.surrealdbUrl.replace(/\/rpc$/, "")
    return {
        httpBase: wsBase.replace(/^ws(s?):\/\//, "http$1://"),
        wsBase,
    }
}

function buildSnapshotRuntimeConfig(baseConfig: Config): Config {
    return {
        ...baseConfig,
        debugBundlePath: baseConfig.debugBundlePath,
        ingestionEnabled: false,
        ingestionLeaderElection: false,
        surrealdbExternalUrl: undefined,
        surrealdbUrl: `ws://localhost:${baseConfig.surrealdbPort}/rpc`,
        surrealdbStorage: baseConfig.surrealdbStorage || "memory",
    }
}

async function fetchJsonFromPython<T>(pathname: string): Promise<T | null> {
    try {
        const response = await fetch(`${PYTHON_BACKEND}${pathname}`)
        if (!response.ok) return null
        return (await response.json()) as T
    } catch {
        return null
    }
}

function buildVersionsInfo(activeConfig: Config): Record<string, unknown> {
    return {
        bun: Bun.version,
        pythonBackendPort: PYTHON_PORT,
        surrealdbUrl: activeConfig.surrealdbUrl,
        appVersion: "v0.2.0",
    }
}

function buildDebugBundleFilename(date = new Date()): string {
    const stamp = date.toISOString().replace(/[:.]/g, "-")
    return `celery-insights-debug-bundle-${stamp}.zip`
}

// --- SurrealDB subprocess management ---

const SURREAL_BACKOFF_BASE_MS = 1000
const SURREAL_BACKOFF_MAX_MS = 30000
let surrealRestartAttempts = 0

/** Strip ANSI escape codes from a string. */
function stripAnsi(s: string): string {
    return s.replace(/\x1b\[[0-9;]*m/g, "")
}

/** Map Rust tracing levels to our logger levels. */
const RUST_LEVEL_MAP: Record<string, "debug" | "info" | "warn" | "error"> = {
    TRACE: "debug",
    DEBUG: "debug",
    INFO: "info",
    WARN: "warn",
    ERROR: "error",
}

/** Parse a SurrealDB log line (Rust tracing format) and re-emit through surrealLogger. */
function parseSurrealLine(raw: string, defaultLevel: "debug" | "info" | "warn" | "error" = "info"): void {
    const line = stripAnsi(raw).trim()
    if (!line) return

    // Rust tracing format: "2026-03-03T21:47:01.200123Z  INFO surrealdb::module: message"
    const match = line.match(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s+(TRACE|DEBUG|INFO|WARN|ERROR)\s+(.+)$/)
    if (match) {
        const level = RUST_LEVEL_MAP[match[1]] ?? "info"
        surrealLogger[level](match[2])
    } else {
        // Unrecognized format — pass through at the default level
        surrealLogger[defaultLevel](line)
    }
}

function spawnSurrealDB(): ChildProcess {
    bunLogger.info(
        `Spawning SurrealDB subprocess on port ${runtimeConfig.surrealdbPort} (storage: ${runtimeConfig.surrealdbStorage})`,
    )
    const proc = spawn(
        "surreal",
        [
            "start",
            "--no-banner",
            "--bind",
            `0.0.0.0:${runtimeConfig.surrealdbPort}`,
            "--user",
            "root",
            "--pass",
            "root",
            runtimeConfig.surrealdbStorage,
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
    )

    // Pipe stdout and stderr through surrealLogger with line buffering
    if (proc.stdout) {
        const rl = readline.createInterface({ input: proc.stdout })
        rl.on("line", parseSurrealLine)
    }
    if (proc.stderr) {
        const rl = readline.createInterface({ input: proc.stderr })
        rl.on("line", (line) => parseSurrealLine(line, "warn"))
    }

    proc.on("exit", (code) => {
        if (shuttingDown) return
        bunLogger.error(`SurrealDB exited with code ${code}`)
        surrealProcess = null

        const backoffMs = Math.min(SURREAL_BACKOFF_BASE_MS * 2 ** surrealRestartAttempts, SURREAL_BACKOFF_MAX_MS)
        surrealRestartAttempts++
        bunLogger.warn(`Restarting SurrealDB in ${backoffMs}ms (attempt ${surrealRestartAttempts})`)
        setTimeout(() => {
            if (!shuttingDown) {
                surrealProcess = spawnSurrealDB()
            }
        }, backoffMs)
    })

    return proc
}

function createProxyRequestHeaders(headers: Headers): Headers {
    const proxyHeaders = new Headers()

    for (const [key, value] of headers.entries()) {
        if (!REQUEST_HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
            proxyHeaders.set(key, value)
        }
    }

    // Avoid forwarding compressed payload metadata that Bun/undici may rewrite while proxying.
    proxyHeaders.set("accept-encoding", "identity")

    return proxyHeaders
}

function createProxyResponseHeaders(headers: Headers): Headers {
    const proxyHeaders = new Headers(headers)

    for (const header of RESPONSE_HOP_BY_HOP_HEADERS) {
        proxyHeaders.delete(header)
    }

    return proxyHeaders
}

/**
 * Wait for SurrealDB to accept HTTP connections before proceeding.
 * Polls the health endpoint with exponential backoff.
 */
async function waitForSurrealDB(maxWaitMs = 30000): Promise<void> {
    const surrealHttpUrl = runtimeConfig.surrealdbExternalUrl
        ? runtimeConfig.surrealdbExternalUrl.replace(/\/rpc$/, "").replace(/^ws(s?):\/\//, "http$1://")
        : `http://localhost:${runtimeConfig.surrealdbPort}`
    const healthUrl = `${surrealHttpUrl}/health`
    const startTime = Date.now()
    let delayMs = 200

    while (Date.now() - startTime < maxWaitMs) {
        try {
            const res = await fetch(healthUrl)
            if (res.ok) {
                surrealRestartAttempts = 0
                bunLogger.info("SurrealDB is ready")
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

const PYTHON_BACKOFF_BASE_MS = 1000
const PYTHON_BACKOFF_MAX_MS = 30000
let pythonRestartAttempts = 0

function spawnPython(): ChildProcess {
    bunLogger.info(replaySnapshot ? "Spawning Python control-plane subprocess" : "Spawning Python ingester subprocess")
    const proc = spawn("python", ["run.py"], {
        cwd: path.resolve(import.meta.dir, "server"),
        env: {
            ...process.env,
            PORT: String(PYTHON_PORT),
            SURREALDB_URL: runtimeConfig.surrealdbUrl,
            ...(runtimeConfig.surrealdbExternalUrl ? { SURREALDB_EXTERNAL_URL: runtimeConfig.surrealdbExternalUrl } : {}),
            SURREALDB_INGESTER_PASS: runtimeConfig.surrealdbIngesterPass,
            SURREALDB_NAMESPACE: runtimeConfig.surrealdbNamespace,
            SURREALDB_DATABASE: runtimeConfig.surrealdbDatabase,
            SURREALDB_STORAGE: runtimeConfig.surrealdbStorage,
            BROKER_URL: runtimeConfig.brokerUrl,
            RESULT_BACKEND: runtimeConfig.resultBackend,
            CONFIG_FILE: runtimeConfig.configFile,
            TIMEZONE: runtimeConfig.timezone,
            DEBUG: String(runtimeConfig.debug),
            CLEANUP_INTERVAL_SECONDS: String(runtimeConfig.cleanupIntervalSeconds),
            ...(runtimeConfig.taskMaxCount != null ? { TASK_MAX_COUNT: String(runtimeConfig.taskMaxCount) } : {}),
            ...(runtimeConfig.taskRetentionHours != null
                ? { TASK_RETENTION_HOURS: String(runtimeConfig.taskRetentionHours) }
                : {}),
            ...(runtimeConfig.deadWorkerRetentionHours != null
                ? { DEAD_WORKER_RETENTION_HOURS: String(runtimeConfig.deadWorkerRetentionHours) }
                : {}),
            INGESTION_BATCH_INTERVAL_MS: String(runtimeConfig.ingestionBatchIntervalMs),
            LOG_FORMAT: runtimeConfig.logFormat,
            LOG_LEVEL: runtimeConfig.logLevel,
            DEBUG_SNAPSHOT_MODE: replaySnapshot ? "true" : "false",
        },
        stdio: ["ignore", "pipe", "pipe"],
    })

    if (proc.stdout) {
        const rl = readline.createInterface({ input: proc.stdout })
        rl.on("line", (line) => {
            pythonLogBuffer.add(line)
            process.stdout.write(line + "\n")
        })
    }
    if (proc.stderr) {
        const rl = readline.createInterface({ input: proc.stderr })
        rl.on("line", (line) => {
            pythonLogBuffer.add(line)
            process.stderr.write(line + "\n")
        })
    }

    proc.on("exit", (code) => {
        if (shuttingDown) return
        bunLogger.error(`Python ingester exited with code ${code}`)
        pythonProcess = null
        // If we're still leader, restart Python with backoff
        if (replaySnapshot || leaderElection?.isLeader) {
            const backoffMs = Math.min(PYTHON_BACKOFF_BASE_MS * 2 ** pythonRestartAttempts, PYTHON_BACKOFF_MAX_MS)
            pythonRestartAttempts++
            bunLogger.warn(`Restarting Python subprocess in ${backoffMs}ms (attempt ${pythonRestartAttempts})`)
            setTimeout(() => {
                if (!shuttingDown && (replaySnapshot || leaderElection?.isLeader)) {
                    pythonProcess = spawnPython()
                }
            }, backoffMs)
        }
    })

    return proc
}

// --- Signal handling ---

async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return
    shuttingDown = true
    bunLogger.info(`Received ${signal} — shutting down`)

    // 1. Release ingestion lock (if held)
    if (leaderElection) {
        await leaderElection.stop()
    }

    // 2. Kill child processes and wait for them to exit (with timeout)
    const exitPromises: Promise<void>[] = []

    if (pythonProcess) {
        const proc = pythonProcess
        exitPromises.push(new Promise<void>((resolve) => proc.on("exit", () => resolve())))
        proc.kill(signal === "SIGTERM" ? "SIGTERM" : "SIGINT")
    }

    if (surrealProcess) {
        const proc = surrealProcess
        exitPromises.push(new Promise<void>((resolve) => proc.on("exit", () => resolve())))
        proc.kill("SIGTERM")
    }

    // Wait for child processes with a 10-second timeout
    if (exitPromises.length > 0) {
        await Promise.race([Promise.all(exitPromises), Bun.sleep(10000)])
    }

    process.exit(0)
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))

// --- Startup sequence ---
if (config.debugBundlePath) {
    replaySnapshot = await parseDebugSnapshot(config.debugBundlePath)
    runtimeConfig = buildSnapshotRuntimeConfig(config)
    bunLogger.info(`Loaded debug snapshot from ${config.debugBundlePath}`)
}

printBanner(runtimeConfig, replaySnapshot)

const managingSurrealDB = !runtimeConfig.surrealdbExternalUrl

// 1. Start SurrealDB subprocess (or skip if external URL is set)
if (managingSurrealDB) {
    surrealProcess = spawnSurrealDB()
} else {
    bunLogger.info(`Using external SurrealDB at ${runtimeConfig.surrealdbExternalUrl}`)
}

// 2. Wait for SurrealDB to be ready
await waitForSurrealDB()

// 3. Run schema migration (as root — creates namespace, database, tables, ingester user)
await runSchemaMigration(runtimeConfig)

// 4. Connect to SurrealDB as ingester user
const db = new Surreal()
try {
    await db.connect(runtimeConfig.surrealdbUrl, {
        namespace: runtimeConfig.surrealdbNamespace,
        database: runtimeConfig.surrealdbDatabase,
        authentication: {
            namespace: runtimeConfig.surrealdbNamespace,
            database: runtimeConfig.surrealdbDatabase,
            username: "ingester",
            password: runtimeConfig.surrealdbIngesterPass,
        },
    })
    bunLogger.info("Connected to SurrealDB")
} catch (err) {
    bunLogger.error(`Failed to connect to SurrealDB: ${err}`)
    process.exit(1)
}

if (replaySnapshot) {
    if (replaySnapshot.sourceDataSqlPath) {
        await importSurrealNative(runtimeConfig, db, replaySnapshot.sourceDataSqlPath)
    } else if (replaySnapshot.sourceData) {
        await importSurrealData(db, replaySnapshot.sourceData)
    } else {
        throw new Error("Debug snapshot does not contain SurrealDB export data")
    }
    pythonRestartAttempts = 0
    pythonProcess = spawnPython()
    ingestionStatus = "read-only"
} else {
    // 5. Run leader election (spawns Python if this instance becomes leader)
    leaderElection = new LeaderElection({
        db,
        config: runtimeConfig,
        instanceId,
        onBecomeLeader() {
            pythonRestartAttempts = 0
            pythonProcess = spawnPython()
        },
        onLoseLeadership() {
            if (pythonProcess) {
                bunLogger.warn("Lost leadership — stopping Python ingester")
                pythonProcess.kill("SIGTERM")
                pythonProcess = null
            }
        },
    })

    ingestionStatus = await leaderElection.start()
}

// 6. Start serving
const server = Bun.serve({
    port: runtimeConfig.port,
    async fetch(req, server) {
        const url = new URL(req.url)
        const { httpBase: surrealHttpBase } = getSurrealBases(runtimeConfig)

        const isUpgrade = req.headers.get("upgrade")?.toLowerCase() === "websocket"

        // Handle WebSocket upgrade requests for /surreal/* paths (proxy to SurrealDB)
        if (url.pathname.startsWith("/surreal/") && isUpgrade) {
            const surrealPath = url.pathname.slice("/surreal".length) // strip /surreal, keep leading /
            const success = server.upgrade(req, {
                data: {
                    targetPath: surrealPath + url.search,
                    backend: "surreal" as const,
                    protocols: req.headers.get("sec-websocket-protocol") ?? undefined,
                },
            })
            if (success) return undefined
            return new Response("WebSocket upgrade failed", { status: 500 })
        }

        // Handle WebSocket upgrade requests for /ws/* paths (proxy to Python)
        if (url.pathname.startsWith("/ws") && isUpgrade) {
            const success = server.upgrade(req, {
                data: { targetPath: url.pathname + url.search, backend: "python" as const },
            })
            if (success) return undefined
            return new Response("WebSocket upgrade failed", { status: 500 })
        }

        // Bun-served endpoint: frontend configuration
        if (url.pathname === "/api/config") {
            const authRequired = runtimeConfig.surrealdbFrontendPass != null
            return Response.json({
                authRequired,
                surrealPath: "/surreal/rpc",
                ingestionStatus: leaderElection?.status ?? ingestionStatus,
                debugSnapshot: getSnapshotSummary(replaySnapshot),
                // When auth is not required, pass viewer credentials so the frontend
                // can authenticate as a read-only DB user. SurrealDB requires
                // authentication even for tables with FULL select permissions.
                ...(authRequired
                    ? {}
                    : {
                          viewerUser: "viewer",
                          viewerPass: "viewer",
                          viewerNs: runtimeConfig.surrealdbNamespace,
                          viewerDb: runtimeConfig.surrealdbDatabase,
                      }),
            })
        }

        if (url.pathname === "/api/settings/debug-snapshot") {
            const details = getSnapshotDetails(replaySnapshot)
            if (!details) {
                return Response.json({ error: "debug snapshot is not active" }, { status: 404 })
            }
            return Response.json(details)
        }

        if (url.pathname === "/api/settings/download-debug-bundle" && req.method === "POST") {
            let clientInfo: DebugBundleClientInfo
            try {
                clientInfo = (await req.json()) as DebugBundleClientInfo
            } catch {
                return Response.json({ error: "invalid debug bundle request" }, { status: 400 })
            }

            const [serverInfo, retentionInfo, healthInfo, recordCounts, surrealExportSql] = await Promise.all([
                fetchJsonFromPython<Record<string, unknown>>("/api/settings/info"),
                fetchJsonFromPython<Record<string, unknown>>("/api/settings/retention"),
                fetchJsonFromPython<Record<string, unknown>>("/health"),
                getSurrealRecordCounts(db),
                exportSurrealNative(runtimeConfig),
            ])
            const archive = await createDebugBundleArchive({
                config: runtimeConfig,
                includeSecrets: clientInfo.includeSecrets === true,
                clientInfo,
                serverInfo,
                retentionInfo,
                healthInfo,
                versionsInfo: buildVersionsInfo(runtimeConfig),
                recordCounts,
                surrealExportSql,
                logs: {
                    bun: bunLogBuffer.toString(),
                    python: pythonLogBuffer.toString(),
                    surrealdb: surrealLogBuffer.toString(),
                },
                replaySnapshot,
            })

            return new Response(archive, {
                headers: {
                    "Content-Type": "application/zip",
                    "Content-Disposition": `attachment; filename="${buildDebugBundleFilename()}"`,
                },
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

        // Proxy /surreal/* HTTP requests to SurrealDB (strip /surreal prefix)
        if (url.pathname.startsWith("/surreal/")) {
            const surrealPath = url.pathname.slice("/surreal".length)
            const targetUrl = `${surrealHttpBase}${surrealPath}${url.search}`
            try {
                const proxyRes = await fetch(targetUrl, {
                    method: req.method,
                    headers: createProxyRequestHeaders(req.headers),
                    body: req.body,
                })
                return new Response(proxyRes.body, {
                    status: proxyRes.status,
                    statusText: proxyRes.statusText,
                    headers: createProxyResponseHeaders(proxyRes.headers),
                })
            } catch {
                return new Response("SurrealDB unavailable", { status: 502 })
            }
        }

        // Proxy API and metrics routes to the Python backend (only if Python is running)
        if (url.pathname.startsWith("/api") || url.pathname.startsWith("/metrics")) {
            if (!pythonProcess) {
                return new Response("Backend not available (ingestion not active on this instance)", { status: 503 })
            }

            const targetUrl = `${PYTHON_BACKEND}${url.pathname}${url.search}`
            try {
                const proxyRes = await fetch(targetUrl, {
                    method: req.method,
                    headers: createProxyRequestHeaders(req.headers),
                    body: req.body,
                })
                return new Response(proxyRes.body, {
                    status: proxyRes.status,
                    statusText: proxyRes.statusText,
                    headers: createProxyResponseHeaders(proxyRes.headers),
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
            const data = ws.data as { targetPath: string; backend: string; protocols?: string }
            ws._pendingMessages = [] as (string | Buffer)[]

            const baseUrl = data.backend === "surreal" ? getSurrealBases(runtimeConfig).wsBase : PYTHON_WS_BACKEND
            const protocols = data.protocols ? data.protocols.split(",").map((p) => p.trim()) : undefined
            const backendWs = new WebSocket(`${baseUrl}${data.targetPath}`, protocols)
            backendWs.binaryType = "arraybuffer"

            backendWs.onopen = () => {
                ws._backendWs = backendWs
                // Flush any messages that arrived before backend connected
                const pending = ws._pendingMessages as (string | Buffer)[]
                for (const msg of pending) backendWs.send(msg)
                pending.length = 0
            }

            backendWs.onmessage = (event) => {
                ws.send(event.data)
            }

            backendWs.onclose = () => ws.close()
            backendWs.onerror = () => ws.close()
        },
        message(ws, message) {
            const backendWs = ws._backendWs as WebSocket | undefined
            if (backendWs && backendWs.readyState === WebSocket.OPEN) {
                backendWs.send(message)
            } else {
                // Buffer messages until backend connects
                ;(ws._pendingMessages as (string | Buffer)[] | undefined)?.push(message)
            }
        },
        close(ws) {
            const backendWs = ws._backendWs as WebSocket | undefined
            if (backendWs && backendWs.readyState === WebSocket.OPEN) {
                backendWs.close()
            }
        },
    },
})

bunLogger.info(`Celery Insights running at http://localhost:${server.port}`)
