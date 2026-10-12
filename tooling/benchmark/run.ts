import { requireBenchmarkController } from "./controller"
import { execFile } from "node:child_process"
import { mkdir, writeFile, readFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { dirname, resolve } from "node:path"
import { hostname, platform, arch, cpus } from "node:os"
import { promisify } from "node:util"
import { benchmarkIngress, benchmarkFetch } from "./ingress"
import { benchmarkBrowser, benchmarkLiveBrowser } from "./browser"
import { benchmarkRequests, benchmarkConcurrentRequests } from "./requests"
import { artifactInspectionScript } from "./artifacts"
import { resourceSnapshotScript, resourceDelta, resourceTrend, type ResourceSnapshot } from "./resources"
import { benchmarkQueries } from "./queries"
import { storageSnapshotScript } from "./storage"
import { benchmarkMaintenance } from "./maintenance"

requireBenchmarkController()
const execute = promisify(execFile)
const args = process.argv.slice(2)
const valueOptions = new Set([
  "--tasks",
  "--rate",
  "--reader-mode",
  "--output",
  "--result-bytes",
  "--drop-sequence",
  "--request-count",
  "--request-rate",
  "--request-concurrency",
  "--browser-profile",
  "--history-tasks",
  "--history-payload-bytes",
  "--query-repetitions",
  "--seed-timeout-seconds",
  "--runner-class",
  "--image",
  "--expected-source-sha",
  "--resource-interval-seconds",
  "--burst-rate",
  "--burst-seconds",
  "--burst-at-seconds",
  "--live-clients",
  "--slow-client-delay-ms",
])
for (let index = 0; index < args.length; index++) {
  if (valueOptions.has(args[index])) index++
  else if (
    ![
      "--browser",
      "--browser-live",
      "--restart",
      "--maintenance",
      "--api",
      "--api-extended",
      "--api-during-ingestion",
      "--artifacts",
      "--queries",
      "--pull",
    ].includes(args[index])
  )
    throw new Error(`Unknown benchmark option: ${args[index]}`)
}
const option = (name: string, fallback: string) => {
  const index = args.indexOf(name)
  if (index < 0) return fallback
  const value = args[index + 1]
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`)
  return value
}
const positive = (name: string, fallback: string) => {
  const value = Number(option(name, fallback))
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`)
  return value
}
const tasks = positive("--tasks", "256")
const rate = positive("--rate", "100")
const liveClients = positive("--live-clients", "1")
const slowClientDelayMs = Number(option("--slow-client-delay-ms", "0"))
if (liveClients > 16) throw new Error("Live clients must be at most 16")
if (!Number.isInteger(slowClientDelayMs) || slowClientDelayMs < 0 || slowClientDelayMs > 1000)
  throw new Error("Slow-client delay must be between zero and 1000 milliseconds")
if (slowClientDelayMs > 0 && liveClients < 2) throw new Error("Slow-client delay requires at least two live clients")
const burst = args.includes("--burst-rate")
  ? {
      rate: positive("--burst-rate", "0"),
      seconds: positive("--burst-seconds", "0"),
      atSeconds: positive("--burst-at-seconds", "0"),
    }
  : null
if (burst && burst.rate < rate) throw new Error("Burst rate must be at least the steady rate")
if (burst && tasks * 4 <= burst.atSeconds * rate + burst.rate * burst.seconds)
  throw new Error("The workload must include the complete burst and a recovery period")
if (!burst && ["--burst-seconds", "--burst-at-seconds"].some((name) => args.includes(name)))
  throw new Error("Burst parameters require --burst-rate")
const resourceIntervalSeconds = Number(option("--resource-interval-seconds", "0"))
if (
  !Number.isInteger(resourceIntervalSeconds) ||
  resourceIntervalSeconds < 0 ||
  (resourceIntervalSeconds > 0 && resourceIntervalSeconds < 5)
)
  throw new Error("Resource interval must be zero (disabled) or at least five seconds")
const readerMode = option("--reader-mode", "shared")
if (!["shared", "separate", "none"].includes(readerMode)) throw new Error("Unknown reader mode")
const notificationBuffer = Number(process.env.BENCH_NOTIFICATION_BUFFER ?? "100")
if (!Number.isInteger(notificationBuffer) || notificationBuffer < 2)
  throw new Error("BENCH_NOTIFICATION_BUFFER must be an integer of at least 2")
const requestCount = positive("--request-count", "120")
if (args.includes("--api-extended") && !args.includes("--api")) throw new Error("--api-extended requires --api")
const requestRate = positive("--request-rate", "40")
const requestConcurrency = positive("--request-concurrency", "32")
const historyTasks = Number(option("--history-tasks", "0"))
if (args.includes("--api-during-ingestion") && historyTasks < 4)
  throw new Error("API during ingestion requires at least four historical tasks")
const historyPayloadBytes = Number(option("--history-payload-bytes", "256"))
if (!Number.isInteger(historyTasks) || historyTasks < 0) throw new Error("History tasks must be nonnegative")
if (args.includes("--maintenance") && historyTasks === 0)
  throw new Error("Maintenance requires historical data to expire")
if (!Number.isInteger(historyPayloadBytes) || historyPayloadBytes < 0 || historyPayloadBytes > 100_000)
  throw new Error("Invalid history payload size")
const queryRepetitions = positive("--query-repetitions", "3")
const seedTimeoutSeconds = positive("--seed-timeout-seconds", "600")
const referenceTime = new Date().toISOString()
const imageReference = option("--image", process.env.BENCH_IMAGE ?? "celery-insights-benchmark:local")
process.env.BENCH_IMAGE = imageReference
const expectedSourceSha = args.includes("--expected-source-sha") ? option("--expected-source-sha", "") : null
if (expectedSourceSha && !/^[0-9a-f]{40}$/.test(expectedSourceSha))
  throw new Error("Expected source SHA must be a full Git commit SHA")
const browserProfile = option("--browser-profile", "desktop")
if (browserProfile !== "desktop" && browserProfile !== "constrained") throw new Error("Unknown browser profile")
const id = `ci-bench-${Date.now()}`
const output = resolve(option("--output", `test-results/benchmark/${id}`))
const compose = ["compose", "-f", "tooling/benchmark/compose.yml", "-p", id]
const command = async (file: string, commandArgs: string[], timeout = 120_000) => {
  try {
    const result = await execute(file, commandArgs, { timeout, maxBuffer: 64 * 1024 * 1024 })
    return { ...result, code: 0 }
  } catch (error) {
    if (!(error instanceof Error)) throw error
    const failure = error as Error & {
      stdout?: string
      stderr?: string
      code?: number
      signal?: string
      killed?: boolean
    }
    return {
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? error.message,
      code: failure.code ?? 1,
      failure: {
        message: error.message,
        code: failure.code,
        signal: failure.signal,
        killed: failure.killed,
        timeoutMs: timeout,
      },
    }
  }
}
const docker = (...commandArgs: string[]) => command("docker", [...compose, ...commandArgs])
const required = async (promise: ReturnType<typeof command>) => {
  const result = await promise
  if (result.code !== 0) throw new Error(result.stderr)
  return result.stdout
}
const jsonFile = (name: string, data: unknown) => writeFile(resolve(output, name), JSON.stringify(data, null, 2))
let ingress: Awaited<ReturnType<typeof benchmarkIngress>> | undefined
const lifecycleStarted = performance.now()
const report: Record<string, unknown> = {
  schemaVersion: 3,
  executionContractVersion: 1,
  runId: id,
  status: "incomplete",
  startedAt: new Date().toISOString(),
  scenario: {
    tasks,
    rate,
    readerMode,
    liveClients,
    slowClientDelayMs,
    resultBytes: option("--result-bytes", "0"),
    dropSequence: option("--drop-sequence", "-1"),
    requests: args.includes("--api")
      ? {
          count: requestCount,
          rate: requestRate,
          maxInFlight: requestConcurrency,
          mixVersion: args.includes("--api-extended") ? 2 : 1,
        }
      : null,
    browser: args.includes("--browser") ? browserProfile : null,
    liveBrowser: args.includes("--browser-live"),
    concurrentRequests: args.includes("--api-during-ingestion")
      ? { count: requestCount, rate: requestRate, maxInFlight: requestConcurrency, mixVersion: 1 }
      : null,
    restart: args.includes("--restart"),
    maintenance: args.includes("--maintenance"),
    resourceIntervalSeconds,
    burst,
    artifacts: args.includes("--artifacts"),
    history: {
      tasks: historyTasks,
      payloadBytes: historyPayloadBytes,
      referenceTime,
      setupDeadlineSeconds: seedTimeoutSeconds,
    },
    queries: args.includes("--queries") ? { repetitions: queryRepetitions } : null,
  },
}
await mkdir(dirname(output), { recursive: true })
await mkdir(output)
let sampling = false
let phase = "ingestion"
let sampler: Promise<void> | undefined
const telemetry: unknown[] = []
try {
  ingress = await benchmarkIngress(output)
  const harnessFiles = [
    "run.ts",
    "requests.ts",
    "browser.ts",
    "artifacts.ts",
    "resources.ts",
    "queries.ts",
    "storage.ts",
    "maintenance.ts",
    "history.py",
    "pipeline.py",
    "compose.yml",
    "observation.ts",
    "ingress.ts",
    "controller.ts",
  ].map((file) => `tooling/benchmark/${file}`)
  harnessFiles.push(
    "runtime/observation/queries.ts",
    "src/lib/task-search.ts",
    "src/lib/indexed-search.ts",
    "src/types/surreal-records.ts",
    "bun.lock",
    "uv.lock",
  )
  report.harness = {
    bunVersion: process.versions.bun,
    files: Object.fromEntries(
      await Promise.all(
        harnessFiles.map(async (file) => [
          file,
          createHash("sha256")
            .update(await readFile(resolve(file)))
            .digest("hex"),
        ]),
      ),
    ),
  }
  report.sourceSha = (await required(command("git", ["rev-parse", "HEAD"]))).trim()
  report.sourceStatus = await required(command("git", ["status", "--porcelain"]))
  if (expectedSourceSha && (report.sourceSha !== expectedSourceSha || report.sourceStatus !== ""))
    throw new Error("Expected source SHA requires that exact clean checkout")
  report.environment = {
    hostname: hostname(),
    platform: platform(),
    architecture: arch(),
    cpuModel: cpus()[0]?.model,
    cpuCount: cpus().length,
    runnerClass: option("--runner-class", `local:${hostname()}`),
  }
  const dockerInfo = JSON.parse(await required(command("docker", ["info", "--format", "{{json .}}"])))
  ;(report.environment as Record<string, unknown>).docker = Object.fromEntries(
    ["OperatingSystem", "OSType", "Architecture", "NCPU", "MemTotal", "KernelVersion", "ServerVersion"].map((key) => [
      key,
      dockerInfo[key],
    ]),
  )
  if (args.includes("--pull")) {
    const cached = await command("docker", ["image", "inspect", imageReference])
    const started = performance.now()
    const fetched = await command("docker", ["pull", imageReference], 600_000)
    report.imageFetch = {
      reference: imageReference,
      presentBeforePull: cached.code === 0,
      durationMs: performance.now() - started,
      commandCode: fetched.code,
    }
    await writeFile(resolve(output, "image-fetch.log"), fetched.stdout + fetched.stderr)
    await required(Promise.resolve(fetched))
  }
  const image = JSON.parse(await required(command("docker", ["image", "inspect", imageReference])))
  report.image = {
    reference: imageReference,
    id: image[0].Id,
    architecture: image[0].Architecture,
    unpackedBytes: image[0].Size,
    revision: image[0].Config.Labels?.["org.opencontainers.image.revision"] ?? null,
  }
  if (expectedSourceSha && image[0].Config.Labels?.["org.opencontainers.image.revision"] !== expectedSourceSha)
    throw new Error("Production image revision does not match the expected source SHA")
  console.warn(`Starting isolated benchmark ${id}; ${tasks * 4} events at ${rate}/s`)
  const setup = performance.now()
  await required(docker("up", "-d", "app"))
  const address = (await required(docker("port", "app", "8555"))).trim()
  let url = `http://${address}`
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await benchmarkFetch(`${url}/health`, { signal: AbortSignal.timeout(1000) })
      if (response.ok) break
    } catch {
      /* Startup is measured until the readiness deadline. */
    }
    if (attempt >= 120) throw new Error("HTTP readiness deadline exceeded")
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  report.setupToHttpReadyMs = performance.now() - setup
  const containerId = (await required(docker("ps", "-q", "app"))).trim()
  ;(report.environment as Record<string, unknown>).serviceImages = Object.fromEntries(
    await Promise.all(
      ["broker", "results"].map(async (service) => {
        const dependencyId = (await required(docker("ps", "-q", service))).trim()
        const dependency = JSON.parse(await required(command("docker", ["inspect", dependencyId])))[0]
        return [service, dependency.Image]
      }),
    ),
  )
  const container = JSON.parse(await required(command("docker", ["inspect", containerId])))[0]
  report.containerConfiguration = container.HostConfig
  report.applicationConfiguration = Object.fromEntries(
    (container.Config.Env as string[])
      .map((entry) => {
        const separator = entry.indexOf("=")
        return [entry.slice(0, separator), entry.slice(separator + 1)]
      })
      .filter(([key]) =>
        ["SURREALDB_STORAGE", "SEARCH_INDEXING_ENABLED", "SURREAL_WEBSOCKET_RESPONSE_CHANNEL_SIZE"].includes(key),
      ),
  )
  report.diskBeforeWorkload = await docker("exec", "-T", "app", "du", "-sk", "/data")
  const storage = async () =>
    JSON.parse(await required(docker("run", "--rm", "-T", "storage", "-c", storageSnapshotScript)))
  if (historyTasks) report.storageBeforeSeed = await storage()
  const resourcePhases: unknown[] = []
  report.resourcePhases = resourcePhases
  const snapshot = async (): Promise<ResourceSnapshot> =>
    JSON.parse(await required(docker("exec", "-T", "app", "python", "-c", resourceSnapshotScript)))
  const measureResources = async <T>(name: string, operation: () => Promise<T>): Promise<T> => {
    const controllerStarted = performance.now()
    const before = await snapshot()
    const observation: Record<string, unknown> = { name, before, status: "running" }
    resourcePhases.push(observation)
    let outcome: { status: "completed"; result: T } | { status: "failed"; error: unknown }
    try {
      const result = await operation()
      observation.status = "completed"
      outcome = { status: "completed", result }
    } catch (error) {
      observation.status = "failed"
      observation.operationError = String(error)
      outcome = { status: "failed", error }
    }
    try {
      const after = await snapshot()
      observation.after = after
      observation.summary = resourceDelta(before, after)
    } catch (error) {
      observation.snapshotError = String(error)
      observation.controllerElapsedMs = performance.now() - controllerStarted
      // Preserve the original failure if the app died during the workload.
      if (outcome.status === "completed") throw error
    }
    observation.controllerElapsedMs = performance.now() - controllerStarted
    if (outcome.status === "failed") throw outcome.error
    return outcome.result
  }
  sampling = true
  const sample = async () => {
    let nextResourceAt = performance.now()
    while (sampling) {
      const phaseAtStart = phase
      const startedAt = new Date().toISOString()
      const result = await command("docker", ["stats", "--no-stream", "--format", "{{json .}}", containerId])
      telemetry.push({ startedAt, finishedAt: new Date().toISOString(), phaseAtStart, phaseAtEnd: phase, ...result })
      if (resourceIntervalSeconds && performance.now() >= nextResourceAt) {
        try {
          const native = await snapshot()
          const timeline = (report.resourceTimeline ??= []) as unknown[]
          timeline.push({ phaseAtStart, phaseAtEnd: phase, snapshot: native })
        } catch (error) {
          const errors = (report.resourceSamplingErrors ??= []) as string[]
          errors.push(String(error))
        }
        nextResourceAt = performance.now() + resourceIntervalSeconds * 1000
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  sampler = sample()
  if (historyTasks) {
    phase = "history-seeding"
    const seed = await measureResources("history-seeding", () =>
      command(
        "docker",
        [
          ...compose,
          "run",
          "--rm",
          "-T",
          "--entrypoint",
          "python",
          "producer",
          "/benchmark/history.py",
          "--tasks",
          String(historyTasks),
          "--reference-time",
          referenceTime,
          "--payload-bytes",
          String(historyPayloadBytes),
        ],
        seedTimeoutSeconds * 1000,
      ),
    )
    await writeFile(resolve(output, "history.stdout"), seed.stdout)
    await writeFile(resolve(output, "history.stderr"), seed.stderr)
    if (seed.code !== 0) {
      report.history = { status: "incomplete", stage: "setup", commandCode: seed.code, commandFailure: seed.failure }
      throw new Error("History setup did not complete; inspect history.stderr, history.stdout, and commandFailure")
    }
    report.history = JSON.parse(seed.stdout.trim().split("\n").at(-1) ?? "null")
    report.storageAfterSeed = await storage()
  }
  ingress.setBackend(url)
  report.transport = {
    browser: "local-https-proxy",
    programmatic: "internal-http-ws-basic",
    accountRole: "administrator",
    ingressTrace: process.env.BENCH_INGRESS_TRACE === "true",
  }
  phase = "ingestion"
  const producerArgs = [
    "--tasks",
    String(tasks),
    "--rate",
    String(rate),
    "--reader-mode",
    readerMode,
    "--live-clients",
    String(liveClients),
    "--slow-client-delay-ms",
    String(slowClientDelayMs),
  ]
  if (burst)
    producerArgs.push(
      "--burst-rate",
      String(burst.rate),
      "--burst-seconds",
      String(burst.seconds),
      "--burst-at-seconds",
      String(burst.atSeconds),
    )
  for (const name of ["--drop-sequence", "--result-bytes"]) {
    if (args.includes(name)) producerArgs.push(name, option(name, "0"))
  }
  const workload = await measureResources("pipeline-container-run", async () => {
    const rawProduce = () =>
      command(
        "docker",
        [...compose, "run", "--rm", "-T", "producer", ...producerArgs],
        Math.ceil((tasks * 4) / rate + 90) * 1000,
      )
    const produce = async () => {
      if (!args.includes("--api-during-ingestion")) return rawProduce()
      const mixed = await benchmarkConcurrentRequests(
        url,
        historyTasks,
        tasks,
        requestCount,
        requestRate,
        requestConcurrency,
        rawProduce,
      )
      report.concurrentRequests = mixed.requests
      return mixed.production
    }
    if (!args.includes("--browser-live")) return produce()
    const live = await benchmarkLiveBrowser(
      ingress!.url,
      tasks,
      produce,
      Math.max(60_000, Math.ceil((tasks * 4) / rate + 60) * 1000),
    )
    report.liveBrowser = live.browser
    return live.production
  })
  await writeFile(resolve(output, "producer.stdout"), workload.stdout)
  await writeFile(resolve(output, "producer.stderr"), workload.stderr)
  report.pipeline = JSON.parse(workload.stdout.trim().split("\n").at(-1) ?? "null")
  if (args.includes("--queries")) {
    phase = "viewer-queries"
    report.queries = await measureResources("viewer-queries-including-validation", () =>
      benchmarkQueries(url, historyTasks, tasks, referenceTime, queryRepetitions),
    )
  }
  if (args.includes("--api")) {
    phase = "requests"
    report.requests = await measureResources("requests-including-warmup", () =>
      benchmarkRequests(
        url,
        tasks,
        requestCount,
        requestRate,
        requestConcurrency,
        historyTasks,
        args.includes("--api-extended"),
      ),
    )
  }
  if (args.includes("--browser")) {
    phase = "browser"
    report.browser = await measureResources("browser-journey", () =>
      benchmarkBrowser(ingress!.url, browserProfile, output),
    )
  }
  sampling = false
  await sampler
  if (args.includes("--artifacts")) {
    report.artifacts = JSON.parse(await required(docker("exec", "-T", "app", "bun", "-e", artifactInspectionScript)))
  }
  report.disk = await docker("exec", "-T", "app", "du", "-sk", "/data")
  if (args.includes("--restart")) {
    phase = "cached-image-restart"
    const started = performance.now()
    await required(docker("restart", "app"))
    url = `http://${(await required(docker("port", "app", "8555"))).trim()}`
    const revalidation = await docker(
      "run",
      "--rm",
      "-T",
      "producer",
      "--validate-only",
      "--tasks",
      String(tasks),
      "--result-bytes",
      option("--result-bytes", "0"),
    )
    await writeFile(resolve(output, "restart-validation.stdout"), revalidation.stdout)
    await writeFile(resolve(output, "restart-validation.stderr"), revalidation.stderr)
    report.restart = {
      ...JSON.parse(revalidation.stdout.trim().split("\n").at(-1) ?? "null"),
      restartToValidatedDataMs: performance.now() - started,
      cache: "image-present-existing-volume-page-cache-unspecified",
      limitations: [
        "Orderly Compose restart including shutdown, command and validator startup; not native pod cold/warm startup or crash recovery.",
      ],
    }
  }
  if (args.includes("--maintenance")) {
    phase = "maintenance"
    report.maintenance = await measureResources("maintenance-export-import-retention", () =>
      benchmarkMaintenance(url, historyTasks, tasks, storage, output),
    )
    const validation = await docker(
      "run",
      "--rm",
      "-T",
      "producer",
      "--validate-only",
      "--tasks",
      String(tasks),
      "--result-bytes",
      option("--result-bytes", "0"),
    )
    await writeFile(resolve(output, "maintenance-validation.stdout"), validation.stdout)
    await writeFile(resolve(output, "maintenance-validation.stderr"), validation.stderr)
    report.maintenanceValidation = JSON.parse(validation.stdout.trim().split("\n").at(-1) ?? "null")
    if ((report.maintenanceValidation as { status?: string }).status !== "passed")
      (report.maintenance as { status: string }).status = "failed"
  }
  if (historyTasks) {
    report.storageAfterWorkload = await storage()
    await required(docker("stop", "app"))
    report.storageAfterStop = await storage()
  }
  const statuses = [
    report.pipeline,
    report.requests,
    report.concurrentRequests,
    report.browser,
    report.liveBrowser,
    report.restart,
    report.maintenance,
    report.queries,
    report.history,
  ]
    .filter(Boolean)
    .map((scenario) => (scenario as { status?: string }).status)
  report.status = statuses.includes("failed")
    ? "failed"
    : statuses.includes("inconclusive")
      ? "inconclusive"
      : statuses.every((status) => status === "passed")
        ? "passed"
        : "incomplete"
} catch (error) {
  report.status = (report.history as { status?: string } | undefined)?.status === "incomplete" ? "incomplete" : "failed"
  report.error = error instanceof Error ? error.message : String(error)
} finally {
  await ingress?.close()

  sampling = false
  await sampler
  if (resourceIntervalSeconds) {
    const timeline = (report.resourceTimeline ?? []) as {
      phaseAtStart: string
      phaseAtEnd: string
      snapshot: ResourceSnapshot
    }[]
    report.ingestionResourceTrend = resourceTrend(
      timeline
        .filter((sample) => sample.phaseAtStart === "ingestion" && sample.phaseAtEnd === "ingestion")
        .map((sample) => sample.snapshot),
    )
  }
  await jsonFile("telemetry.json", telemetry)
  const logs = await docker("logs", "--no-color", "app")
  await writeFile(resolve(output, "app.log"), logs.stdout + logs.stderr)
  report.flushFailures = (logs.stdout.match(/Failed to flush/g) ?? []).length
  const finalId = await docker("ps", "-aq", "app")
  if (finalId.code === 0 && finalId.stdout.trim()) {
    const inspection = await command("docker", ["inspect", finalId.stdout.trim()])
    if (inspection.code === 0) report.containerFinalState = JSON.parse(inspection.stdout)[0].State
    else report.containerInspectionError = inspection.stderr
  }
  report.finishedAt = new Date().toISOString()
  report.costAccounting = { beforeCleanupMs: performance.now() - lifecycleStarted }
  await jsonFile("result.json", report)
  const cleanupStarted = performance.now()
  const cleanup = await docker("down", "-v", "--remove-orphans")
  await writeFile(resolve(output, "cleanup.log"), cleanup.stdout + cleanup.stderr)
  report.cleanup = {
    status: cleanup.code === 0 ? "passed" : "failed",
    durationMs: performance.now() - cleanupStarted,
    commandCode: cleanup.code,
  }
  if (cleanup.code !== 0) report.status = "incomplete"
  report.costAccounting = {
    ...(report.costAccounting as Record<string, unknown>),
    totalControllerMs: performance.now() - lifecycleStarted,
  }
  report.finishedAt = new Date().toISOString()
  await jsonFile("result.json", report)
  process.stdout.write(JSON.stringify({ output, status: report.status, flushFailures: report.flushFailures }) + "\n")
  if (report.status !== "passed" || cleanup.code !== 0) process.exitCode = 1
}
