import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { randomUUID, createHash } from "node:crypto"
import { mkdir, readFile, writeFile, rm } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { parseDebugSnapshot } from "../../runtime/debug-bundle"
import { benchmarkBrowser } from "./browser"
import { maintenanceDeadline, validateBackup, validateRestoredPayloads } from "./maintenance"
import { Surreal } from "surrealdb"
import { extractId } from "../../src/types/surreal-records"
import { idFingerprint, validateReturnedRows } from "./queries"

const execute = promisify(execFile)
export async function benchmarkReplay(
  image: string,
  output: string,
  sourceImage = image,
  format: "native" | "legacy-json" = "native",
) {
  await mkdir(dirname(resolve(output)), { recursive: true })
  await mkdir(output)
  const project = `ci-replay-${randomUUID().slice(0, 8)}`
  const report: Record<string, unknown> = {
    schemaVersion: 1,
    status: "incomplete",
    project,
    bundleFormat: format,
    startedAt: new Date().toISOString(),
    cases: [],
    limitations: [
      "Synthetic 128-task history and 32 real-broker tasks. Debug-bundle v2 native export/replay is distinct from JSON backup/import.",
      "Cached production image; replay controller timing includes startup, native import, probe observation and validation. Not large-bundle replay capacity.",
      "Background polling stays active during source export; synthetic readiness-worker heartbeats can vary independently of task history.",
    ],
  }
  const commands: unknown[] = []
  const run = async (file: string, args: string[], cwd = process.cwd()) => {
    const started = performance.now()
    try {
      const result = await execute(file, args, {
        timeout: 180000,
        maxBuffer: 32 * 1024 * 1024,
        cwd,
        env: {
          ...process.env,
          BENCH_IMAGE: sourceImage,
          BENCH_CPU: "2",
          BENCH_MEMORY: "2g",
          BENCH_INDEXING: "false",
          BENCH_NOTIFICATION_BUFFER: "100",
          BENCH_STORAGE: "rocksdb:///data/store",
        },
      })
      commands.push({ file, args, code: 0, durationMs: performance.now() - started })
      return result.stdout
    } catch (error) {
      const failure = error as { stdout?: string; stderr?: string; code?: unknown }
      commands.push({
        file,
        args,
        code: failure.code ?? 1,
        durationMs: performance.now() - started,
        stdout: failure.stdout,
        stderr: failure.stderr,
      })
      throw new Error(`${file} ${args[0]} failed: ${failure.stderr?.slice(-2000) ?? String(error)}`)
    }
  }
  const overlay = resolve(output, "replay-compose.json")
  const composeArgs = ["compose", "-f", "tooling/benchmark/compose.yml", "-f", overlay, "-p", project]
  const compose = (...args: string[]) => run("docker", [...composeArgs, ...args])
  const cases = report.cases as Record<string, unknown>[]
  const measured = async <T>(name: string, operation: () => Promise<T>) => {
    const started = performance.now()
    try {
      const result = await operation()
      cases.push({ name, status: "passed", durationMs: performance.now() - started })
      return result
    } catch (error) {
      cases.push({ name, status: "failed", durationMs: performance.now() - started, error: String(error) })
      throw error
    }
  }
  const request = async (url: string, path: string, init: RequestInit = {}) => {
    const response = await fetch(url + path, { ...init, signal: AbortSignal.timeout(120000) })
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
    return response
  }
  await writeFile(
    overlay,
    JSON.stringify(
      {
        services: {
          replay: {
            image,
            cpus: 2,
            mem_limit: "2g",
            ports: ["127.0.0.1::8555"],
            environment: {
              DEBUG_BUNDLE_PATH: format === "native" ? "/snapshot/source.zip" : "/snapshot/legacy-source.zip",
              SURREALDB_STORAGE: "rocksdb:///data/store",
              INGESTION_ENABLED: "false",
              SEARCH_INDEXING_ENABLED: "false",
              SURREALDB_INGESTER_PASS: "benchmark-ingester",
              LOG_FORMAT: "json",
            },
            volumes: [`${resolve(output)}:/snapshot:ro`, "replay-data:/data"],
          },
        },
        volumes: { "replay-data": {} },
      },
      null,
      2,
    ),
  )
  let extracted: string | undefined
  try {
    const inspection = JSON.parse(await run("docker", ["image", "inspect", image]))[0]
    report.image = { reference: image, id: inspection.Id, architecture: inspection.Architecture }
    const sourceInspection = JSON.parse(await run("docker", ["image", "inspect", sourceImage]))[0]
    report.sourceImage = {
      reference: sourceImage,
      id: sourceInspection.Id,
      architecture: sourceInspection.Architecture,
    }
    report.sourceSha = (await run("git", ["rev-parse", "HEAD"])).trim()
    report.sourceStatus = await run("git", ["status", "--porcelain"])
    report.harness = Object.fromEntries(
      await Promise.all(
        ["replay.ts", "pipeline.py", "history.py", "browser.ts", "maintenance.ts"].map(async (file) => [
          file,
          createHash("sha256")
            .update(await readFile(new URL(file, import.meta.url)))
            .digest("hex"),
        ]),
      ),
    )
    await measured("source.setup", () => compose("up", "-d", "--wait", "app"))
    const sourceUrl = `http://${(await compose("port", "app", "8555")).trim()}`
    const seed = await measured("source.history", () =>
      compose(
        "run",
        "--rm",
        "-T",
        "--entrypoint",
        "python",
        "producer",
        "/benchmark/history.py",
        "--tasks",
        "128",
        "--reference-time",
        new Date().toISOString(),
      ),
    )
    report.history = JSON.parse(seed.trim().split("\n").at(-1) ?? "null")
    const produced = await measured("source.ingestion", () =>
      compose("run", "--rm", "-T", "producer", "--tasks", "32", "--rate", "100"),
    )
    report.pipeline = JSON.parse(produced.trim().split("\n").at(-1) ?? "null")
    if (
      (report.history as { status?: string }).status !== "passed" ||
      (report.pipeline as { status?: string }).status !== "passed"
    )
      throw new Error("Source fixture did not pass independent validation")
    const original = await (await request(sourceUrl, "/api/settings/export")).json()
    validateBackup(original, 128, 32)
    const archive = await measured(
      "debug-bundle.export",
      async () =>
        new Uint8Array(
          await (
            await request(sourceUrl, "/api/settings/download-debug-bundle", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                includeSecrets: false,
                settings: {},
                screenWidth: 1440,
                screenHeight: 900,
                userAgent: "benchmark",
                locale: "en-US",
                timezone: "UTC",
                colorScheme: "light",
                devicePixelRatio: 1,
              }),
            })
          ).arrayBuffer(),
        ),
    )
    const bundle = resolve(output, "source.zip")
    await writeFile(bundle, archive, { flag: "wx" })
    report.bundle = { bytes: archive.byteLength, sha256: createHash("sha256").update(archive).digest("hex") }
    const parsed = await maintenanceDeadline(parseDebugSnapshot(bundle), 15000, "Debug bundle parse")
    extracted = parsed.extractedDir
    if (
      parsed.manifest.version !== 2 ||
      !parsed.manifest.source.redacted ||
      parsed.manifest.source.recordCounts.tasks !== 160 ||
      !parsed.sourceDataSqlPath
    )
      throw new Error("Debug bundle source manifest/native export differs from fixture")
    report.manifest = parsed.manifest
    if (format === "legacy-json") {
      // Generate an old-format fixture from independently captured source data,
      // keeping the original native archive unchanged as export evidence.
      await writeFile(resolve(extracted, "source/data/surrealdb-export.json"), JSON.stringify(original))
      await rm(parsed.sourceDataSqlPath!)
      const legacy = resolve(output, "legacy-source.zip")
      await measured("fixture.convert-legacy-json", () =>
        run("zip", ["-q", "-r", legacy, "manifest.json", "source"], extracted),
      )
      const bytes = await readFile(legacy)
      report.replayBundle = { bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") }
    }
    await measured("replay.start-to-validated-data", async () => {
      await compose("up", "-d", "--wait", "replay")
      const url = `http://${(await compose("port", "replay", "8555")).trim()}`
      const details = await (await request(url, "/api/settings/debug-snapshot")).json()
      if (details.enabled !== true || details.readOnly !== true) throw new Error("Snapshot replay is not read-only")
      const restored = await (await request(url, "/api/settings/export")).json()
      validateBackup(restored, 128, 32)
      validateRestoredPayloads(original, restored)
      const graph = new Surreal()
      try {
        await maintenanceDeadline(
          graph.connect(`${url.replace(/^http/, "ws")}/surreal/rpc`, {
            namespace: "celery_insights",
            database: "main",
            reconnect: false,
          }),
          10000,
          "Replay graph connection",
        )
        await maintenanceDeadline(
          graph.signin({ namespace: "celery_insights", database: "main", username: "viewer", password: "viewer" }),
          10000,
          "Replay graph authentication",
        )
        const [workflows, edges] = await maintenanceDeadline(
          graph
            .query<[Record<string, unknown>[], { in: unknown; out: unknown }[]]>(
              "SELECT * FROM workflow; SELECT `in`, out FROM workflow_task;",
            )
            .collect(),
          10000,
          "Replay graph query",
        )
        validateReturnedRows(workflows, "workflows.all", 128, 32)
        const expected = [
          ...Array.from({ length: 128 }, (_, index) => `history-${index - (index % 4)}:history-${index}`),
          ...Array.from({ length: 32 }, (_, index) => `bench-${index - (index % 4)}:bench-${index}`),
        ]
        if (
          idFingerprint(edges.map((edge) => `${extractId(edge.in)}:${extractId(edge.out)}`)) !== idFingerprint(expected)
        )
          throw new Error("Replay workflow memberships differ")
        report.workflowMemberships = { status: "passed", edges: edges.length, workflows: workflows.length }
      } finally {
        await maintenanceDeadline(graph.close(), 5000, "Replay graph close")
      }
      let validator: string
      try {
        validator = await compose(
          "run",
          "--rm",
          "-T",
          "-e",
          "BENCH_DB_URL=ws://replay:8555/surreal/rpc",
          "producer",
          "--tasks",
          "32",
          "--validate-only",
          "--drain-seconds",
          "3",
        )
      } catch (error) {
        const failure = commands.at(-1) as { stdout?: string }
        if (!failure.stdout) throw error
        validator = failure.stdout
      }
      report.replayValidation = JSON.parse(validator.trim().split("\n").at(-1) ?? "null")
      if ((report.replayValidation as { status?: string }).status !== "passed")
        throw new Error("Replayed task/event/workflow oracle failed")
      const denied = await fetch(url + "/api/settings/cleanup", { method: "POST", signal: AbortSignal.timeout(10000) })
      if (denied.status !== 403) throw new Error(`Snapshot replay allowed mutation: HTTP ${denied.status}`)
      report.browser = await benchmarkBrowser(url)
      if ((report.browser as { status?: string }).status !== "passed")
        throw new Error("Replayed production browser did not pass")
    })
    report.status = "passed"
  } catch (error) {
    report.error = String(error)
    report.status = "failed"
  } finally {
    for (const service of ["app", "replay", "broker", "results"]) {
      try {
        await writeFile(resolve(output, `${service}.log`), await compose("logs", "--no-color", service))
      } catch {
        /* Setup may precede service creation. */
      }
    }
    try {
      await compose("down", "-v", "--remove-orphans")
      report.cleanedUp = true
    } catch (error) {
      report.cleanedUp = false
      report.cleanupError = String(error)
      report.status = "incomplete"
    }
    if (extracted) await rm(extracted, { recursive: true, force: true })
    report.finishedAt = new Date().toISOString()
    await writeFile(resolve(output, "commands.json"), JSON.stringify(commands, null, 2))
    await writeFile(resolve(output, "replay.json"), JSON.stringify(report, null, 2) + "\n")
  }
  return report
}
