/**
 * Custom Bun entry point for production.
 * Orchestrates SurrealDB subprocess, leader election, Python ingester spawning,
 * serves the SPA and authorized observation APIs; Python supplies a private Celery bridge.
 *
 * Usage: bun run bun-entry.ts
 * (after building with `bun run build`)
 */
import path from "node:path"
import readline from "node:readline"
import { spawn, type ChildProcess } from "node:child_process"
import { randomBytes } from "node:crypto"
import { Surreal } from "surrealdb"
import { createCeleryBridge } from "./runtime/celery-bridge"
import { ObservationApi } from "./runtime/observation-api"
import { initializeAuthentication, secureApplicationRequest } from "./runtime/security/http"
import { ObservationRpc } from "./runtime/observation/rpc"
import { buildRead, readPermissions, readRequestSchema } from "./runtime/observation/queries"
import { intersectScopes, scopeFingerprint, scopedDatabase, rowScoped } from "./runtime/security/read-scope"
import { AuthError } from "./runtime/security/permissions"
import { Authorization } from "./runtime/security/opa"
import { payloadPermissions } from "./runtime/security/permissions"
import type { Config } from "./runtime/config"
import { resolveConfig } from "./runtime/config-loader"
import { pythonConfig, pythonEnvironment } from "./runtime/python-config"
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
} from "./runtime/debug-bundle"
import { bunLogger, configureLogging, registerLogSink, surrealLogger } from "./runtime/logger"
import { LeaderElection, generateInstanceId, type IngestionStatus } from "./runtime/leader-election"

const resolvedConfig = resolveConfig()
const config = resolvedConfig.config
configureLogging(config.logFormat, config.logLevel)
for (const warning of resolvedConfig.warnings) bunLogger.warn(warning)
import { startSearchIndexes, type SearchIndexes } from "./runtime/search-indexes"
import { runSchemaMigration } from "./runtime/surreal-schema"
import { createMcpHandler } from "./runtime/mcp"

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

`.trim()

// --- Startup banner ---

function printBanner(runtimeConfig: Config, replaySnapshot: ParsedDebugSnapshot | null): void {
  if (runtimeConfig.logFormat !== "pretty") return

  const isTTY = process.stdout.isTTY === true
  const c = isTTY
    ? { reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m", green: "\x1b[32m" }
    : { reset: "", dim: "", bold: "", green: "" }

  const logo = `${c.green}${c.bold}${LOGO}${c.reset}\n`

  const surrealInfo = runtimeConfig.surrealdbExternalUrl
    ? "external (endpoint redacted)"
    : `managed (${runtimeConfig.surrealdbStorage}) on port ${runtimeConfig.surrealdbPort}`

  const ingestionInfo = replaySnapshot
    ? "snapshot replay (read-only)"
    : !runtimeConfig.ingestionEnabled
      ? "disabled"
      : runtimeConfig.ingestionLeaderElection
        ? "enabled (leader election)"
        : "enabled (standalone)"

  const retention: string[] = []
  if (runtimeConfig.taskMaxCount !== null && runtimeConfig.taskMaxCount !== undefined)
    retention.push(`max ${runtimeConfig.taskMaxCount} tasks`)
  if (runtimeConfig.taskRetentionHours !== null && runtimeConfig.taskRetentionHours !== undefined)
    retention.push(`tasks: ${runtimeConfig.taskRetentionHours}h`)
  if (runtimeConfig.deadWorkerRetentionHours !== null && runtimeConfig.deadWorkerRetentionHours !== undefined)
    retention.push(`dead workers: ${runtimeConfig.deadWorkerRetentionHours}h`)

  const lines = [
    `  ${c.dim}Server${c.reset}      http://localhost:${runtimeConfig.port}${runtimeConfig.urlPrefix}/`,
    `  ${c.dim}Broker${c.reset}      [redacted]`,
    `  ${c.dim}Backend${c.reset}     [redacted]`,
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

const celeryBridge = createCeleryBridge()

const DIST_DIR = path.resolve(import.meta.dir, "dist")

// Read index.html once at startup for SPA fallback
const indexHtml = await Bun.file(path.join(DIST_DIR, "index.html")).text()

let surrealProcess: ChildProcess | null = null
let pythonProcess: ChildProcess | null = null
let searchIndexes: SearchIndexes | null = null
let leaderElection: LeaderElection | null = null
let mcpDb: Surreal | null = null
let authentication: Awaited<ReturnType<typeof initializeAuthentication>> | null = null
let cleanupTimer: ReturnType<typeof setTimeout> | null = null
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
    const options: RequestInit & { unix: string } = { unix: celeryBridge.socket }
    const response = await fetch(`http://localhost${pathname}`, options)
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

function buildVersionsInfo(activeConfig: Config): Record<string, unknown> {
  return {
    bun: Bun.version,
    pythonBridgeTransport: "private-unix-socket",
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
  let result = ""
  let index = 0

  while (index < s.length) {
    if (s[index] === "\u001B" && s[index + 1] === "[") {
      index += 2

      while (index < s.length) {
        const char = s[index]
        if ((char >= "0" && char <= "9") || char === ";") {
          index += 1
          continue
        }

        if (char === "m") {
          index += 1
          break
        }

        result += "\u001B["
        break
      }

      continue
    }

    result += s[index]
    index += 1
  }

  return result
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
      `127.0.0.1:${runtimeConfig.surrealdbPort}`,
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
  bunLogger.info(replaySnapshot ? "Spawning Python Celery bridge subprocess" : "Spawning Python ingester subprocess")
  const proc = spawn("python", ["run.py"], {
    cwd: path.resolve(import.meta.dir, "server"),
    env: pythonEnvironment(process.env),
    stdio: ["ignore", "pipe", "pipe", "pipe"],
  })
  const configPipe = proc.stdio[3]
  if (!configPipe || !("end" in configPipe)) throw new Error("Cannot open Python configuration pipe")
  configPipe.on("error", () => bunLogger.error("Python configuration handoff failed"))
  configPipe.end(JSON.stringify(pythonConfig(runtimeConfig, Boolean(replaySnapshot), celeryBridge)))

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

async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  bunLogger.info(`Received ${signal} — shutting down`)

  // 1. Release ingestion lock (if held)
  if (leaderElection) {
    await leaderElection.stop()
  }
  await searchIndexes?.stop()
  await mcpDb?.close()
  if (cleanupTimer) clearTimeout(cleanupTimer)

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

  celeryBridge.close()
  process.exit(exitCode)
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
  bunLogger.info("Using external SurrealDB (endpoint redacted)")
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

searchIndexes = await startSearchIndexes(db, runtimeConfig)

try {
  authentication = resolvedConfig.authentication
    ? initializeAuthentication(resolvedConfig.authentication, new Authorization(runtimeConfig))
    : null
} catch {
  bunLogger.error("Authentication initialization failed")
  await shutdown("startup failure", 1)
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
// Keep MCP reads on their own VIEWER connection, including replicas without Python.
mcpDb = new Surreal()
await mcpDb.connect(runtimeConfig.surrealdbUrl, {
  namespace: runtimeConfig.surrealdbNamespace,
  database: runtimeConfig.surrealdbDatabase,
  authentication: {
    namespace: runtimeConfig.surrealdbNamespace,
    database: runtimeConfig.surrealdbDatabase,
    username: "observation_reader",
    password: runtimeConfig.surrealdbIngesterPass,
  },
})
const mcpCursorCredential =
  runtimeConfig.mcpCursorSecret ??
  (runtimeConfig.surrealdbIngesterPass !== "changeme"
    ? runtimeConfig.surrealdbIngesterPass
    : randomBytes(32).toString("hex"))
const handleMcp = createMcpHandler({
  authorize: async (request, tool) => {
    if (!authentication) throw new Error("Authentication required")
    const decision = await authentication.authorization.check(
      authentication.principal(request),
      payloadPermissions,
      { method: request.method, path: "/mcp", transport: "mcp", tool },
      Boolean(replaySnapshot),
    )
    const scope = intersectScopes(authentication.scope(request), decision)
    return {
      db: scopedDatabase(mcpDb!, scope),
      readScope: scope,
      cursorSecret: `${mcpCursorCredential}:${authentication.principal(request).account_id}:${scopeFingerprint(scope)}`,
    }
  },
  publicOrigin: resolvedConfig.authentication?.public_origin,
  db: mcpDb,
  cursorSecret: `${mcpCursorCredential}:${runtimeConfig.surrealdbNamespace}:${runtimeConfig.surrealdbDatabase}`,
  allowedHosts: runtimeConfig.mcpAllowedHosts?.split(",").map((host) => host.trim()),
  mode: () => (replaySnapshot ? "snapshot" : runtimeConfig.ingestionEnabled ? "live" : "ingestion_disabled"),
})
const observationApi = new ObservationApi(db, runtimeConfig, () => fetchJsonFromPython("/bridge/status"))
async function periodicCleanup() {
  if (!replaySnapshot && runtimeConfig.ingestionEnabled && (!leaderElection || leaderElection.isLeader)) {
    try {
      await observationApi.cleanup()
    } catch {
      bunLogger.error("Observation cleanup failed")
    }
  }
  if (!shuttingDown) cleanupTimer = setTimeout(periodicCleanup, observationApi.cleanupInterval())
}
cleanupTimer = setTimeout(periodicCleanup, observationApi.cleanupInterval())
const server = Bun.serve({
  port: runtimeConfig.port,
  async fetch(req: Request, server: any) {
    return secureApplicationRequest(req, runtimeConfig.urlPrefix, authentication, Boolean(replaySnapshot), async () => {
      const url = new URL(req.url)

      const prefix = runtimeConfig.urlPrefix
      if (prefix && url.pathname === prefix) {
        return new Response(null, { status: 308, headers: { Location: `${prefix}/${url.search}` } })
      }
      if (prefix && url.pathname !== "/health" && !url.pathname.startsWith(`${prefix}/`)) {
        return new Response("Not Found", { status: 404 })
      }
      // Keep the root health endpoint available for container probes.
      if (url.pathname !== "/health") url.pathname = url.pathname.slice(prefix.length)

      const scope = /^\/(api|metrics|mcp)(?:\/|$)/.test(url.pathname) ? authentication!.scope(req) : null
      if (
        scope &&
        rowScoped(scope) &&
        ["/api/settings/info", "/api/settings/debug-snapshot", "/metrics/system"].includes(url.pathname)
      )
        throw new AuthError(403, "Operation requires unrestricted cluster visibility")
      const scopedApi =
        scope && (req.method === "GET" || url.pathname === "/api/exports/csv")
          ? observationApi.withDatabase(scopedDatabase(db, scope!))
          : observationApi
      const applicationResponse = await scopedApi.handle(req, url.pathname, Boolean(replaySnapshot))
      if (applicationResponse) return applicationResponse
      if (url.pathname === "/mcp") return handleMcp(req)

      const isUpgrade = req.headers.get("upgrade")?.toLowerCase() === "websocket"

      if (url.pathname === "/api/observation/rpc") {
        if (isUpgrade) {
          const protocols = (req.headers.get("sec-websocket-protocol") ?? "").split(",").map((value) => value.trim())
          if (!protocols.some((value) => value === "cbor" || value === "json"))
            return new Response(null, { status: 400 })
          const json = !protocols.includes("cbor")
          if (
            server.upgrade(req, {
              data: {
                account: authentication!.principal(req).account_id,
                scope,
                json,
                authRequest: req.headers.has("cookie")
                  ? new Request(req.url, { headers: { cookie: req.headers.get("cookie")! } })
                  : undefined,
              },
              headers: { "sec-websocket-protocol": json ? "json" : "cbor" },
            })
          )
            return undefined
          return new Response("WebSocket upgrade failed", { status: 500 })
        }
        if (req.method !== "POST") return new Response(null, { status: 405 })
        if (Number(req.headers.get("content-length")) > 65536) return new Response(null, { status: 413 })
        const reader = req.body?.getReader()
        if (!reader) return new Response(null, { status: 422 })
        const chunks: Uint8Array[] = []
        let size = 0
        try {
          for (;;) {
            const { value, done } = await reader.read()
            if (done) break
            size += value.length
            if (size > 65536) {
              await reader.cancel()
              return new Response(null, { status: 413 })
            }
            chunks.push(value)
          }
        } finally {
          reader.releaseLock()
        }
        let value: unknown
        try {
          value = JSON.parse(Buffer.concat(chunks).toString("utf8"))
        } catch {
          return Response.json({ detail: "Invalid observation request" }, { status: 422 })
        }
        const parsed = readRequestSchema.safeParse(value)
        if (!parsed.success) return Response.json({ detail: "Invalid observation request" }, { status: 422 })
        const context = {
          method: "POST",
          path: url.pathname,
          transport: "http" as const,
          operation: parsed.data.operation,
        }
        const decision = await authentication!.authorization.check(
          authentication!.principal(req),
          readPermissions(parsed.data, authentication!.principal(req)),
          context,
          Boolean(replaySnapshot),
        )
        const read = buildRead(parsed.data)
        const rows = await scopedDatabase(db, intersectScopes(scope!, decision)).query(read.sql, read.bindings).json()
        const fresh = await authentication!.authorization.check(
          authentication!.principal(req),
          readPermissions(parsed.data, authentication!.principal(req)),
          context,
          Boolean(replaySnapshot),
        )
        if (scopeFingerprint(decision) !== scopeFingerprint(fresh)) throw new AuthError(403, "Read scope changed")
        return Response.json(rows.slice(read.resultOffset))
      }

      // Bun-served endpoint: frontend configuration
      if (url.pathname === "/api/config") {
        return Response.json({
          ui: {
            demoAvailable: runtimeConfig.demoAvailable ?? true,
            theme: runtimeConfig.uiTheme,
            hideWelcomeBanner: runtimeConfig.uiHideWelcomeBanner,
            rawEventsLimit: runtimeConfig.uiRawEventsLimit,
          },
          observationPath: `${runtimeConfig.urlPrefix}/api/observation/rpc`,
          ingestionStatus: leaderElection?.status ?? ingestionStatus,
          debugSnapshot:
            scope && rowScoped(scope) && replaySnapshot
              ? { enabled: true, readOnly: true }
              : getSnapshotSummary(replaySnapshot),
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
          observationApi
            .handle(new Request("http://localhost/api/settings/info"), "/api/settings/info", Boolean(replaySnapshot))
            .then((response) => response?.json()),
          observationApi
            .handle(
              new Request("http://localhost/api/settings/retention"),
              "/api/settings/retention",
              Boolean(replaySnapshot),
            )
            .then((response) => response?.json()),
          fetchJsonFromPython<Record<string, unknown>>("/health"),
          getSurrealRecordCounts(db),
          exportSurrealNative(runtimeConfig),
        ])
        const archive = await createDebugBundleArchive({
          config: runtimeConfig,
          includeSecrets: false,
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

        return new Response(new Blob([new Uint8Array(archive)]), {
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
          surrealdb: managingSurrealDB ? (surrealProcess ? "running" : "stopped") : "external",
          python: pythonProcess ? "running" : "not running",
        })
      }

      // Application APIs are owned by Bun. There is no public Python proxy.
      if (url.pathname.startsWith("/api") || url.pathname.startsWith("/metrics"))
        return new Response("Not Found", { status: 404 })

      // Serve static assets (JS/CSS bundles, SVGs, fonts, images)
      if (url.pathname.startsWith("/assets/") || url.pathname.match(/\.(svg|png|ico|jpg|css|js|woff2?|ttf|map)$/)) {
        const filePath = path.resolve(DIST_DIR, "." + url.pathname)
        if (!filePath.startsWith(DIST_DIR + path.sep)) return new Response("Forbidden", { status: 403 })
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
        return new Response("Not Found", { status: 404 })
      }

      // SPA fallback — serve index.html for all other routes
      return new Response(
        indexHtml.replace(
          '<base href="/" />',
          `<base href="${runtimeConfig.urlPrefix}/"><meta name="url-prefix" content="${runtimeConfig.urlPrefix}">`,
        ),
        {
          headers: { "Content-Type": "text/html" },
        },
      )
    })
  },
  websocket: {
    maxPayloadLength: 65536,
    backpressureLimit: 16 * 1024 * 1024,
    closeOnBackpressureLimit: true,
    open(ws: any) {
      ws.data.rpc = new ObservationRpc(
        ws,
        authentication!,
        ws.data.account,
        db,
        ws.data.scope,
        Boolean(replaySnapshot),
        ws.data.json,
        5000,
        ws.data.authRequest,
      )
    },
    message(ws: any, message: string | Buffer) {
      void ws.data.rpc?.receive(message)
    },
    close(ws: any) {
      ws.data.rpc?.stop()
    },
  },
})

bunLogger.info(`Celery Insights running at http://localhost:${server.port}${runtimeConfig.urlPrefix}/`)
