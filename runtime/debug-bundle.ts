import path from "node:path"
import os from "node:os"
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile, cp } from "node:fs/promises"
import type { Config } from "./config"
import type { Surreal } from "surrealdb"

export interface DebugBundleClientInfo {
  includeSecrets?: boolean
  settings: Record<string, unknown>
  screenWidth: number
  screenHeight: number
  userAgent: string
  locale: string | null
  timezone: string | null
  colorScheme: "light" | "dark" | "system" | "unknown"
  devicePixelRatio: number
}

export interface DebugBundleManifestSection {
  createdAt: string
  redacted: boolean
  recordCounts: {
    tasks: number
    events: number
    workers: number
  }
}

export interface DebugBundleManifest {
  format: "celery-insights-debug-bundle"
  version: 2
  source: DebugBundleManifestSection
  replay?: DebugBundleManifestSection
}

export interface SurrealExport {
  version: 1
  tasks: Record<string, unknown>[]
  events: Record<string, unknown>[]
  workers: Record<string, unknown>[]
}

export interface ParsedDebugSnapshot {
  bundlePath: string
  extractedDir: string
  manifest: DebugBundleManifest
  sourceConfig: Record<string, unknown>
  sourceRuntime: Record<string, unknown>
  sourceRetention: Record<string, unknown> | null
  sourceVersions: Record<string, unknown> | null
  sourceHealth: Record<string, unknown> | null
  sourceUi: Record<string, unknown>
  sourceData: SurrealExport | null
  sourceDataSqlPath: string | null
  sourceLogs: {
    bun: string
    python: string
    surrealdb: string
  }
}

export interface SnapshotSummary {
  enabled: boolean
  readOnly: boolean
  bundlePath?: string
  manifestVersion?: number
  capturedAt?: string
  replayedAt?: string
  redacted?: boolean
  recordCounts?: {
    tasks: number
    events: number
    workers: number
  }
}

export interface SnapshotDetails {
  enabled: boolean
  readOnly: boolean
  bundlePath: string
  manifest: DebugBundleManifest
  sourceConfig: Record<string, unknown>
  sourceRuntime: Record<string, unknown>
  sourceRetention: Record<string, unknown> | null
  sourceVersions: Record<string, unknown> | null
  sourceHealth: Record<string, unknown> | null
  sourceUi: Record<string, unknown>
  sourceLogs: {
    bun: string
    python: string
    surrealdb: string
  }
}

export class LineRingBuffer {
  private readonly lines: string[] = []

  constructor(private readonly maxLines = 400) {}

  add(line: string): void {
    if (!line) return
    this.lines.push(line)
    if (this.lines.length > this.maxLines) {
      this.lines.splice(0, this.lines.length - this.maxLines)
    }
  }

  toString(): string {
    return this.lines.join("\n")
  }
}

type CollectableQueryResult = {
  collect: () => Promise<unknown>
}

function normalizeQueryResult<T>(result: unknown): T[] {
  if (!Array.isArray(result) || result.length === 0) return []
  const [first] = result
  if (Array.isArray(first)) return first as T[]
  return result as T[]
}

async function resolveQueryResult(result: unknown): Promise<unknown> {
  if (result && typeof result === "object" && "collect" in result && typeof result.collect === "function") {
    return (result as CollectableQueryResult).collect()
  }
  return await Promise.resolve(result)
}

export function redactConfig(config: Config, includeSecrets: boolean): Record<string, unknown> {
  const data: Record<string, unknown> = { ...config }
  if (!includeSecrets) {
    for (const key of ["surrealdbIngesterPass", "surrealdbFrontendPass", "brokerUrl", "resultBackend"]) {
      if (key in data && data[key] !== null && data[key] !== undefined) {
        data[key] = "***REDACTED***"
      }
    }
  }
  return data
}

async function runCommand(cmd: string[], cwd?: string): Promise<string> {
  const proc = Bun.spawn(cmd, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (exitCode !== 0) {
    throw new Error(stderr.trim() || `Command failed: ${cmd.join(" ")}`)
  }
  return stdout
}

async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true })
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath))
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8")
}

async function writeText(filePath: string, data: string): Promise<void> {
  await ensureDir(path.dirname(filePath))
  await writeFile(filePath, data, "utf8")
}

async function maybeCopyFile(sourcePath: string, destinationPath: string): Promise<boolean> {
  try {
    const fileInfo = await stat(sourcePath)
    if (!fileInfo.isFile()) return false
    await ensureDir(path.dirname(destinationPath))
    await cp(sourcePath, destinationPath)
    return true
  } catch {
    return false
  }
}

async function readJsonFromZip<T>(bundlePath: string, entry: string): Promise<T> {
  const content = await runCommand(["unzip", "-p", bundlePath, entry])
  return JSON.parse(content) as T
}

async function readTextFromZip(bundlePath: string, entry: string): Promise<string> {
  return runCommand(["unzip", "-p", bundlePath, entry])
}

export async function exportSurrealData(db: Surreal): Promise<SurrealExport> {
  const [tasksResult, eventsResult, workersResult] = await Promise.all([
    resolveQueryResult(db.query("SELECT * FROM task")),
    resolveQueryResult(db.query("SELECT * FROM event")),
    resolveQueryResult(db.query("SELECT * FROM worker")),
  ])

  return {
    version: 1,
    tasks: normalizeQueryResult<Record<string, unknown>>(tasksResult),
    events: normalizeQueryResult<Record<string, unknown>>(eventsResult),
    workers: normalizeQueryResult<Record<string, unknown>>(workersResult),
  }
}

export function getRecordCounts(exportData: SurrealExport) {
  return {
    tasks: exportData.tasks.length,
    events: exportData.events.length,
    workers: exportData.workers.length,
  }
}

export async function getSurrealRecordCounts(db: Surreal): Promise<DebugBundleManifestSection["recordCounts"]> {
  const [tasksResult, eventsResult, workersResult] = await Promise.all([
    resolveQueryResult(db.query("SELECT VALUE count() FROM task GROUP ALL")),
    resolveQueryResult(db.query("SELECT VALUE count() FROM event GROUP ALL")),
    resolveQueryResult(db.query("SELECT VALUE count() FROM worker GROUP ALL")),
  ])

  const toCount = (result: unknown): number => {
    const values = normalizeQueryResult<number | { count?: number }>(result)
    const [first] = values
    if (typeof first === "number") return first
    if (first && typeof first === "object" && "count" in first && typeof first.count === "number") return first.count
    return 0
  }

  return {
    tasks: toCount(tasksResult),
    events: toCount(eventsResult),
    workers: toCount(workersResult),
  }
}

function getSurrealHttpEndpoint(config: Config): string {
  return config.surrealdbUrl.replace(/\/rpc$/, "").replace(/^ws(s?):\/\//, "http$1://")
}

export async function exportSurrealNative(config: Config): Promise<string> {
  const fullExport = await runCommand([
    "surreal",
    "export",
    "--log",
    "none",
    "--endpoint",
    getSurrealHttpEndpoint(config),
    "--username",
    "root",
    "--password",
    "root",
    "--auth-level",
    "root",
    "--namespace",
    config.surrealdbNamespace,
    "--database",
    config.surrealdbDatabase,
    "--only",
    "--records",
    "true",
    "--tables",
    "task,event,worker",
    "-",
  ])
  return extractSurrealTableData(fullExport, ["event", "task", "worker"])
}

export function extractSurrealTableData(sql: string, tables: readonly string[]): string {
  const statements: string[] = ["OPTION IMPORT;"]

  for (const table of tables) {
    const header = `-- ------------------------------\n-- TABLE DATA: ${table}\n-- ------------------------------\n\n`
    const start = sql.indexOf(header)
    if (start === -1) continue
    const bodyStart = start + header.length
    const nextSection = sql.indexOf("\n-- ------------------------------\n-- TABLE:", bodyStart)
    const body = (nextSection === -1 ? sql.slice(bodyStart) : sql.slice(bodyStart, nextSection)).trim()
    if (!body) continue
    statements.push(body)
  }

  return `${statements.join("\n\n")}\n`
}

export async function importSurrealNative(config: Config, db: Surreal, sourcePath: string): Promise<void> {
  await resolveQueryResult(
    db.query("DELETE FROM task; DELETE FROM event; DELETE FROM worker; DELETE FROM ingestion_lock;"),
  )
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "celery-insights-surreal-import-"))
  const importPath = path.join(tempRoot, "surreal-import.surql")

  try {
    await cp(sourcePath, importPath)
    await runCommand([
      "surreal",
      "import",
      "--log",
      "none",
      "--endpoint",
      getSurrealHttpEndpoint(config),
      "--username",
      "root",
      "--password",
      "root",
      "--auth-level",
      "root",
      "--namespace",
      config.surrealdbNamespace,
      "--database",
      config.surrealdbDatabase,
      importPath,
    ])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to import native SurrealDB snapshot: ${message}`)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

function toSurrealRecordId(table: string, rawId: unknown): string | null {
  if (rawId === null || rawId === undefined) return null
  let id = String(rawId)
  if (id.includes(":")) {
    id = id.split(":", 2)[1] ?? id
  }
  id = id.replace(/^⟨|⟩$/g, "")
  return id || null
}

interface ImportRecord {
  id: string
  data: Record<string, unknown>
}

const DATETIME_FIELDS: Record<"task" | "event" | "worker", readonly string[]> = {
  task: [
    "sent_at",
    "received_at",
    "started_at",
    "succeeded_at",
    "failed_at",
    "retried_at",
    "revoked_at",
    "rejected_at",
    "last_updated",
  ],
  event: ["timestamp"],
  worker: ["last_updated"],
}

function reviveDateFields(
  table: "task" | "event" | "worker",
  record: Record<string, unknown>,
): Record<string, unknown> {
  const revived = { ...record }
  for (const field of DATETIME_FIELDS[table]) {
    const value = revived[field]
    if (typeof value !== "string") continue
    const parsed = new Date(value)
    if (Number.isNaN(parsed.valueOf())) continue
    revived[field] = parsed
  }
  return revived
}

function chunkRecords(records: ImportRecord[], chunkSize: number): ImportRecord[][] {
  const chunks: ImportRecord[][] = []
  for (let index = 0; index < records.length; index += chunkSize) {
    chunks.push(records.slice(index, index + chunkSize))
  }
  return chunks
}

export async function importSurrealData(db: Surreal, data: SurrealExport): Promise<void> {
  if (data.version !== 1) {
    throw new Error(`Unsupported SurrealDB export version: ${data.version}`)
  }

  const params: Record<string, ImportRecord[]> = {
    tasks: [],
    events: [],
    workers: [],
  }

  for (const [table, records, key] of [
    ["task", data.tasks, "tasks"],
    ["event", data.events, "events"],
    ["worker", data.workers, "workers"],
  ] as const) {
    records.forEach((record, index) => {
      const id = toSurrealRecordId(table, record.id)
      if (!id) {
        throw new Error(`Invalid ${table} record without id at index ${index}`)
      }
      const copy = { ...record }
      delete copy.id
      params[key].push({
        id,
        data: reviveDateFields(table, copy),
      })
    })
  }

  const chunkSize = 1000
  const queryLines = [
    "BEGIN TRANSACTION",
    "DELETE FROM task",
    "DELETE FROM event",
    "DELETE FROM worker",
    "DELETE FROM ingestion_lock",
  ]
  const chunkParams: Record<string, ImportRecord[]> = {}

  for (const [table, records, key] of [
    ["task", params.tasks, "tasks"],
    ["event", params.events, "events"],
    ["worker", params.workers, "workers"],
  ] as const) {
    const chunks = chunkRecords(records, chunkSize)
    chunks.forEach((chunk, index) => {
      const paramName = `${key}_${index}`
      chunkParams[paramName] = chunk
      queryLines.push(
        `FOR $record IN $${paramName} { UPSERT type::record('${table}', $record.id) CONTENT $record.data; }`,
      )
    })
  }
  queryLines.push("COMMIT TRANSACTION")
  const query = `${queryLines.join(";\n")};`

  try {
    await resolveQueryResult(db.query(query, chunkParams))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Failed to import SurrealDB snapshot (tasks=${params.tasks.length}, events=${params.events.length}, workers=${params.workers.length}): ${message}`,
    )
  }
}

async function listEntries(bundlePath: string): Promise<Set<string>> {
  const output = await runCommand(["unzip", "-Z1", bundlePath])
  return new Set(
    output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  )
}

export async function parseDebugSnapshot(bundlePath: string): Promise<ParsedDebugSnapshot> {
  const entries = await listEntries(bundlePath)
  if (!entries.has("manifest.json")) {
    throw new Error("Unsupported debug bundle: manifest.json is missing")
  }

  const manifest = await readJsonFromZip<DebugBundleManifest>(bundlePath, "manifest.json")
  if (manifest.format !== "celery-insights-debug-bundle" || manifest.version !== 2) {
    throw new Error(`Unsupported debug bundle format: expected v2, got ${manifest.version ?? "unknown"}`)
  }

  for (const required of [
    "source/config/effective-config.json",
    "source/runtime/server-info.json",
    "source/ui/client.json",
  ]) {
    if (!entries.has(required)) {
      throw new Error(`Invalid debug bundle: missing ${required}`)
    }
  }
  if (!entries.has("source/data/surrealdb-export.surql") && !entries.has("source/data/surrealdb-export.json")) {
    throw new Error("Invalid debug bundle: missing source/data/surrealdb-export.surql")
  }

  const extractedDir = await mkdtemp(path.join(os.tmpdir(), "celery-insights-snapshot-"))
  await runCommand(["unzip", "-q", bundlePath, "-d", extractedDir])

  return {
    bundlePath,
    extractedDir,
    manifest,
    sourceConfig: await readJsonFromZip<Record<string, unknown>>(bundlePath, "source/config/effective-config.json"),
    sourceRuntime: await readJsonFromZip<Record<string, unknown>>(bundlePath, "source/runtime/server-info.json"),
    sourceRetention: entries.has("source/runtime/retention.json")
      ? await readJsonFromZip<Record<string, unknown>>(bundlePath, "source/runtime/retention.json")
      : null,
    sourceVersions: entries.has("source/runtime/versions.json")
      ? await readJsonFromZip<Record<string, unknown>>(bundlePath, "source/runtime/versions.json")
      : null,
    sourceHealth: entries.has("source/runtime/health.json")
      ? await readJsonFromZip<Record<string, unknown>>(bundlePath, "source/runtime/health.json")
      : null,
    sourceUi: await readJsonFromZip<Record<string, unknown>>(bundlePath, "source/ui/client.json"),
    sourceData: entries.has("source/data/surrealdb-export.json")
      ? await readJsonFromZip<SurrealExport>(bundlePath, "source/data/surrealdb-export.json")
      : null,
    sourceDataSqlPath: entries.has("source/data/surrealdb-export.surql")
      ? path.join(extractedDir, "source/data/surrealdb-export.surql")
      : null,
    sourceLogs: {
      bun: entries.has("source/logs/bun.log") ? await readTextFromZip(bundlePath, "source/logs/bun.log") : "",
      python: entries.has("source/logs/python.log") ? await readTextFromZip(bundlePath, "source/logs/python.log") : "",
      surrealdb: entries.has("source/logs/surrealdb.log")
        ? await readTextFromZip(bundlePath, "source/logs/surrealdb.log")
        : "",
    },
  }
}

export function getSnapshotSummary(snapshot: ParsedDebugSnapshot | null): SnapshotSummary | null {
  if (!snapshot) return null
  return {
    enabled: true,
    readOnly: true,
    bundlePath: snapshot.bundlePath,
    manifestVersion: snapshot.manifest.version,
    capturedAt: snapshot.manifest.source.createdAt,
    replayedAt: snapshot.manifest.replay?.createdAt,
    redacted: snapshot.manifest.source.redacted,
    recordCounts: snapshot.manifest.source.recordCounts,
  }
}

export function getSnapshotDetails(snapshot: ParsedDebugSnapshot | null): SnapshotDetails | null {
  if (!snapshot) return null
  return {
    enabled: true,
    readOnly: true,
    bundlePath: snapshot.bundlePath,
    manifest: snapshot.manifest,
    sourceConfig: snapshot.sourceConfig,
    sourceRuntime: snapshot.sourceRuntime,
    sourceRetention: snapshot.sourceRetention,
    sourceVersions: snapshot.sourceVersions,
    sourceHealth: snapshot.sourceHealth,
    sourceUi: snapshot.sourceUi,
    sourceLogs: snapshot.sourceLogs,
  }
}

async function copyTreeContents(sourceDir: string, destinationDir: string): Promise<void> {
  try {
    const entries = await readdir(sourceDir)
    if (entries.length === 0) return
    await ensureDir(destinationDir)
    await cp(sourceDir, destinationDir, { recursive: true })
  } catch {
    // Missing source dir is acceptable.
  }
}

export async function createDebugBundleArchive(options: {
  config: Config
  includeSecrets: boolean
  clientInfo: DebugBundleClientInfo
  serverInfo: Record<string, unknown> | null
  retentionInfo: Record<string, unknown> | null
  healthInfo: Record<string, unknown> | null
  versionsInfo: Record<string, unknown>
  recordCounts: DebugBundleManifestSection["recordCounts"]
  surrealExportSql: string
  logs: { bun: string; python: string; surrealdb: string }
  replaySnapshot?: ParsedDebugSnapshot | null
}): Promise<Uint8Array> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "celery-insights-debug-bundle-"))
  const stagingDir = path.join(tempRoot, "bundle")
  const zipPath = path.join(tempRoot, "debug-bundle-v2.zip")
  const createdAt = new Date().toISOString()
  const sourceSection = options.replaySnapshot?.manifest.source ?? {
    createdAt,
    redacted: !options.includeSecrets,
    recordCounts: options.recordCounts,
  }

  try {
    await ensureDir(stagingDir)

    if (options.replaySnapshot) {
      await copyTreeContents(path.join(options.replaySnapshot.extractedDir, "source"), path.join(stagingDir, "source"))
    } else {
      await writeJson(
        path.join(stagingDir, "source/config/effective-config.json"),
        redactConfig(options.config, options.includeSecrets),
      )
      await maybeCopyFile(options.config.configFile, path.join(stagingDir, "source/config/config.py"))
      await writeJson(path.join(stagingDir, "source/runtime/server-info.json"), options.serverInfo ?? {})
      await writeJson(path.join(stagingDir, "source/runtime/retention.json"), options.retentionInfo ?? {})
      await writeJson(path.join(stagingDir, "source/runtime/health.json"), options.healthInfo ?? {})
      await writeJson(path.join(stagingDir, "source/runtime/versions.json"), options.versionsInfo)
      await writeText(path.join(stagingDir, "source/data/surrealdb-export.surql"), options.surrealExportSql)
      await writeJson(path.join(stagingDir, "source/ui/client.json"), options.clientInfo)
      await writeText(path.join(stagingDir, "source/logs/bun.log"), options.logs.bun)
      await writeText(path.join(stagingDir, "source/logs/python.log"), options.logs.python)
      await writeText(path.join(stagingDir, "source/logs/surrealdb.log"), options.logs.surrealdb)
    }

    if (options.replaySnapshot) {
      await writeJson(path.join(stagingDir, "replay/runtime/server-info.json"), options.serverInfo ?? {})
      await writeJson(path.join(stagingDir, "replay/runtime/retention.json"), options.retentionInfo ?? {})
      await writeJson(path.join(stagingDir, "replay/runtime/health.json"), options.healthInfo ?? {})
      await writeJson(path.join(stagingDir, "replay/runtime/versions.json"), options.versionsInfo)
      await writeJson(path.join(stagingDir, "replay/ui/client.json"), options.clientInfo)
      await writeText(path.join(stagingDir, "replay/logs/bun.log"), options.logs.bun)
      await writeText(path.join(stagingDir, "replay/logs/python.log"), options.logs.python)
      await writeText(path.join(stagingDir, "replay/logs/surrealdb.log"), options.logs.surrealdb)
    }

    const manifest: DebugBundleManifest = {
      format: "celery-insights-debug-bundle",
      version: 2,
      source: sourceSection,
      ...(options.replaySnapshot
        ? {
            replay: {
              createdAt,
              redacted: !options.includeSecrets,
              recordCounts: options.recordCounts,
            },
          }
        : {}),
    }
    await writeJson(path.join(stagingDir, "manifest.json"), manifest)

    await runCommand(["zip", "-q", "-r", zipPath, "."], stagingDir)
    const archive = await readFile(zipPath)
    return new Uint8Array(archive)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}
