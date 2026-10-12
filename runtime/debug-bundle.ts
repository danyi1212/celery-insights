import path from "node:path"
import os from "node:os"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import type { Config } from "./config"
import { SETTINGS } from "./config-registry"
import { DateTime, TextCodec, type RecordIdValue, type Surreal } from "surrealdb"
import { z } from "zod"

const exportSchema = z
  .object({
    version: z.literal(1),
    tasks: z.array(z.record(z.string(), z.unknown())),
    events: z.array(z.record(z.string(), z.unknown())),
    workers: z.array(z.record(z.string(), z.unknown())),
  })
  .strict()

function redactImportedConfig(config: Record<string, unknown>): Record<string, unknown> {
  // Historical bundles may contain additional secrets. Keep only recognized nonsensitive settings.
  return Object.fromEntries(
    SETTINGS.filter((setting) => !setting.secret && setting.key !== "configFile")
      .filter((setting) => Object.hasOwn(config, setting.key))
      .map((setting) => [setting.key, config[setting.key]]),
  )
}

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
  manifest: DebugBundleManifest
  sourceConfig: Record<string, unknown>
  sourceRuntime: Record<string, unknown>
  sourceRetention: Record<string, unknown> | null
  sourceVersions: Record<string, unknown> | null
  sourceHealth: Record<string, unknown> | null
  sourceUi: Record<string, unknown>
  sourceData: SurrealExport | null
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
  // Configured account credentials never belong in task diagnostics,
  // including the legacy includeSecrets export mode.
  for (const setting of SETTINGS)
    if (setting.secret && (setting.path.startsWith("authentication.") || setting.path.startsWith("authorization.")))
      if (data[setting.key] !== undefined) data[setting.key] = "***REDACTED***"
  if (!includeSecrets) {
    for (const key of [
      ...SETTINGS.filter((setting) => setting.secret).map((setting) => setting.key),
      "celeryOptions",
    ]) {
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

function toSurrealRecordId(table: string, rawId: unknown): RecordIdValue | null {
  if (typeof rawId !== "string" || !rawId) return null
  if (!rawId.includes(":")) return rawId
  try {
    const record = TextCodec.parseRecordId(rawId)
    return record.table.name === table ? record.id : null
  } catch {
    return null
  }
}

interface ImportRecord {
  id: RecordIdValue
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
    "first_observed_at",
    "execution_observed_at",
    "execution_active_at",
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
    try {
      revived[field] = new DateTime(value)
    } catch {
      /* Preserve invalid input for the existing import validation/error path. */
    }
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
  data = exportSchema.parse(data)
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
      if (id === null || id === "") {
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
    "DELETE FROM workflow_task",
    "DELETE FROM workflow",
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
  const names = output.split("\n").filter(Boolean)
  if (new Set(names).size !== names.length) throw new Error("Invalid debug bundle: duplicate entries")
  return new Set(output.split("\n").filter(Boolean))
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
  if (!entries.has("source/data/surrealdb-export.json")) {
    throw new Error("SQL-only debug bundles are unsupported; capture a new structured-data bundle")
  }

  return {
    bundlePath,
    manifest,
    sourceConfig: redactImportedConfig(
      await readJsonFromZip<Record<string, unknown>>(bundlePath, "source/config/effective-config.json"),
    ),
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
      ? exportSchema.parse(await readJsonFromZip<SurrealExport>(bundlePath, "source/data/surrealdb-export.json"))
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

export async function createDebugBundleArchive(options: {
  config: Config
  includeSecrets: boolean
  clientInfo: DebugBundleClientInfo
  serverInfo: Record<string, unknown> | null
  retentionInfo: Record<string, unknown> | null
  healthInfo: Record<string, unknown> | null
  versionsInfo: Record<string, unknown>
  recordCounts: DebugBundleManifestSection["recordCounts"]
  surrealExport: SurrealExport
  logs: { bun: string; python: string; surrealdb: string }
  replaySnapshot?: ParsedDebugSnapshot | null
}): Promise<Uint8Array> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "celery-insights-debug-bundle-"))
  const stagingDir = path.join(tempRoot, "bundle")
  const zipPath = path.join(tempRoot, "debug-bundle-v2.zip")
  const createdAt = new Date().toISOString()
  const sourceSection = {
    ...options.replaySnapshot?.manifest.source,
    createdAt: options.replaySnapshot?.manifest.source.createdAt ?? createdAt,
    redacted: true,
    recordCounts: options.recordCounts,
  }

  try {
    await ensureDir(stagingDir)

    if (options.replaySnapshot) {
      const snapshot = options.replaySnapshot
      await writeJson(
        path.join(stagingDir, "source/config/effective-config.json"),
        redactImportedConfig(snapshot.sourceConfig),
      )
      await writeJson(path.join(stagingDir, "source/runtime/server-info.json"), snapshot.sourceRuntime)
      await writeJson(path.join(stagingDir, "source/runtime/retention.json"), snapshot.sourceRetention ?? {})
      await writeJson(path.join(stagingDir, "source/runtime/health.json"), snapshot.sourceHealth ?? {})
      await writeJson(path.join(stagingDir, "source/runtime/versions.json"), snapshot.sourceVersions ?? {})
      await writeJson(path.join(stagingDir, "source/ui/client.json"), snapshot.sourceUi)
      await writeJson(path.join(stagingDir, "source/data/surrealdb-export.json"), options.surrealExport)
      // Imported logs may contain secrets from historical exports; never re-export them.
    } else {
      await writeJson(
        path.join(stagingDir, "source/config/effective-config.json"),
        redactConfig(options.config, options.includeSecrets),
      )
      await writeJson(path.join(stagingDir, "source/runtime/server-info.json"), options.serverInfo ?? {})
      await writeJson(path.join(stagingDir, "source/runtime/retention.json"), options.retentionInfo ?? {})
      await writeJson(path.join(stagingDir, "source/runtime/health.json"), options.healthInfo ?? {})
      await writeJson(path.join(stagingDir, "source/runtime/versions.json"), options.versionsInfo)
      await writeJson(path.join(stagingDir, "source/data/surrealdb-export.json"), options.surrealExport)
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
