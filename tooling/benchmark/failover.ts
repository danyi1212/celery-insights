import { benchmarkIngress, benchmarkFetch } from "./ingress"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { randomUUID, createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { Surreal } from "surrealdb"
import { maintenanceDeadline } from "./maintenance"
import { benchmarkBrowser } from "./browser"

const execute = promisify(execFile)
export function parseFailoverProducerOutput(logs: string, commandFailed: boolean) {
  const result = JSON.parse(logs.trim().split("\n").at(-1) ?? "null")
  if (
    !result ||
    typeof result !== "object" ||
    !["passed", "failed", "incomplete", "inconclusive"].includes(result.status)
  )
    throw new Error("Producer returned no valid result object")
  if (commandFailed && result.status === "passed")
    throw new Error("Producer exited unsuccessfully despite reporting success")
  return result
}

export async function benchmarkFailover(
  image: string,
  output: string,
  arrivalMode: "after-takeover" | "during-failure",
) {
  await mkdir(dirname(resolve(output)), { recursive: true })
  await mkdir(output)
  const ingress = await benchmarkIngress(output)
  const project = `ci-failover-${randomUUID().slice(0, 8)}`
  const pipeline = await readFile(new URL("pipeline.py", import.meta.url), "utf8")
  await writeFile(resolve(output, "pipeline.py"), pipeline)
  const app = () => ({
    image,
    cpus: 1,
    mem_limit: "1g",
    ports: ["127.0.0.1::8555"],
    volumes: [`${ingress.directory}:/benchmark-auth:ro`],
    environment: {
      CELERY_INSIGHTS_CONFIG_FILE: "/benchmark-auth/authentication.toml",
      BROKER_URL: "amqp://benchmark:benchmark@broker/",
      RESULT_BACKEND: "redis://results:6379/0",
      SURREALDB_EXTERNAL_URL: "ws://database:8557/rpc",
      CELERY_INSIGHTS_DATABASE_ROOT_PASSWORD: "root",
      SURREALDB_INGESTER_PASS: "benchmark-ingester",
      SEARCH_INDEXING_ENABLED: "false",
      INGESTION_LOCK_TTL_SECONDS: "30",
      INGESTION_LOCK_HEARTBEAT_SECONDS: "10",
      LOG_FORMAT: "json",
      CLEANUP_INTERVAL_SECONDS: "86400",
    },
  })
  const manifest = {
    services: {
      broker: {
        image: "rabbitmq:4.3.6-management-alpine",
        environment: { RABBITMQ_DEFAULT_USER: "benchmark", RABBITMQ_DEFAULT_PASS: "benchmark" },
      },
      results: { image: "redis:8.10.2-alpine" },
      database: {
        image,
        cpus: 2,
        mem_limit: "2g",
        ports: ["127.0.0.1::8557"],
        volumes: ["data:/data"],
        entrypoint: [
          "surreal",
          "start",
          "--bind",
          "0.0.0.0:8557",
          "--user",
          "root",
          "--pass",
          "root",
          "rocksdb:///data/store",
        ],
        healthcheck: {
          test: ["CMD", "curl", "--fail", "http://127.0.0.1:8557/health"],
          interval: "2s",
          timeout: "2s",
          retries: 30,
        },
      },
      "app-a": app(),
      "app-b": app(),
      producer: {
        image,
        entrypoint: ["python", "/benchmark/pipeline.py"],
        volumes: [`${resolve(output)}:/benchmark:ro`],
        environment: {
          BROKER_URL: "amqp://benchmark:benchmark@broker/",
          RESULT_BACKEND: "redis://results:6379/0",
          BENCH_DB_URL: "ws://database:8557/rpc",
          BENCH_AUTH_ORIGIN: ingress.url,
          BENCH_PUBLIC_URL: "ws://app-b:8555/api/observation/rpc",
          BENCH_WRITER_PASSWORD: "benchmark-ingester",
        },
      },
    },
    volumes: { data: {} },
  }
  const composeFile = resolve(output, "compose.json")
  await writeFile(composeFile, JSON.stringify(manifest, null, 2))
  const commands: unknown[] = []
  const run = async (file: string, args: string[], timeout = 120_000) => {
    const started = performance.now()
    try {
      const result = await execute(file, args, { timeout, maxBuffer: 32 * 1024 * 1024 })
      commands.push({ file, args, elapsedMs: performance.now() - started, code: 0 })
      return result.stdout
    } catch (error) {
      const failure = error as { stdout?: string; stderr?: string; code?: unknown }
      commands.push({
        file,
        args,
        elapsedMs: performance.now() - started,
        code: failure.code,
        stderr: failure.stderr,
        stdout: failure.stdout,
      })
      throw new Error(`${file} ${args[0]} failed: ${failure.stderr ?? "command failure"}`)
    }
  }
  const compose = (...args: string[]) => run("docker", ["compose", "-f", composeFile, "-p", project, ...args])
  const report: Record<string, unknown> = {
    schemaVersion: 1,
    status: "incomplete",
    project,
    arrivalMode,
    startedAt: new Date().toISOString(),
    pipelineSha256: createHash("sha256").update(pipeline).digest("hex"),
    limitations: [
      "Two 1 CPU / 1 GiB app instances share a separate 2 CPU / 2 GiB RocksDB server; broker/backend/generator resources are additional.",
      "Abrupt app-leader termination preserves the external database. This is not database crash recovery or a multi-node storage test.",
      "after-takeover pauses new task events until election; during-failure keeps fixed arrivals. These are distinct correctness scenarios.",
      "A separately created persisted sentinel checks store continuity. The independent real producer validates complete task/raw-event/result history.",
      "Thirty-second lock TTL and ten-second heartbeat are explicit. Status polling is not consumer readiness; the producer commits a readiness probe.",
    ],
  }
  const db = new Surreal()
  let producer: Promise<unknown> | undefined
  try {
    report.sourceSha = (await run("git", ["rev-parse", "HEAD"])).trim()
    report.sourceStatus = await run("git", ["status", "--porcelain"])
    const inspection = JSON.parse(await run("docker", ["image", "inspect", image]))[0]
    report.image = {
      reference: image,
      id: inspection.Id,
      architecture: inspection.Architecture,
      revision: inspection.Config.Labels?.["org.opencontainers.image.revision"] ?? null,
    }
    await compose("up", "-d", "broker", "results", "database")
    const databaseUrl = `http://${(await compose("port", "database", "8557")).trim()}`
    const databaseDeadline = performance.now() + 30_000
    while (true) {
      try {
        if ((await benchmarkFetch(databaseUrl + "/health", { signal: AbortSignal.timeout(1000) })).ok) break
      } catch {
        /* The private native database may not yet be listening. */
      }
      if (performance.now() > databaseDeadline) throw new Error("Database startup deadline exceeded")
      await new Promise((done) => setTimeout(done, 100))
    }
    await maintenanceDeadline(
      db.connect(databaseUrl, { authentication: { username: "root", password: "root" }, reconnect: false }),
      15_000,
      "Failover database connection",
    )
    const statuses: unknown[] = []
    const waitStatus = async (service: string, expected: string, deadlineSeconds: number) => {
      const url = `http://${(await compose("port", service, "8555")).trim()}`
      const start = performance.now()
      while (true) {
        let status: unknown = null
        try {
          status = (await (await benchmarkFetch(url + "/api/config", { signal: AbortSignal.timeout(1000) })).json())
            .ingestionStatus
        } catch {
          /* Preserve readiness progress rather than treating transport errors as ready. */
        }
        statuses.push({ service, elapsedMs: performance.now() - start, status })
        if (status === expected) return { url, elapsedMs: performance.now() - start }
        if (performance.now() - start > deadlineSeconds * 1000) throw new Error(`${service} did not become ${expected}`)
        await new Promise((done) => setTimeout(done, 250))
      }
    }
    await compose("up", "-d", "app-a")
    await waitStatus("app-a", "leader", 60)
    await compose("up", "-d", "app-b")
    const standby = await waitStatus("app-b", "standby", 60)
    report.statusObservations = statuses
    await db.use({ namespace: "celery_insights", database: "main" })
    await maintenanceDeadline(
      db
        .query(
          "CREATE task:`failover-sentinel` SET state = 'SUCCESS', type = 'benchmark.sentinel', workflow_id = 'failover-sentinel', result = 'sentinel-result', last_updated = time::now();",
        )
        .collect(),
      10_000,
      "Persisted sentinel",
    )
    const produce = async () => {
      let logs: string
      let commandFailed = false
      try {
        logs = await compose(
          "run",
          "--rm",
          "-T",
          "producer",
          "--tasks",
          arrivalMode === "during-failure" ? "128" : "32",
          "--rate",
          arrivalMode === "during-failure" ? "20" : "100",
          "--drain-seconds",
          "60",
        )
      } catch (error) {
        commandFailed = true
        // compose exits nonzero on an independently detected correctness failure.
        const failure = commands.at(-1) as { stderr?: string; stdout?: string }
        await writeFile(resolve(output, "producer.stderr"), failure.stderr ?? String(error))
        if (!failure.stdout) throw error
        logs = failure.stdout
      }
      await writeFile(resolve(output, "producer.stdout"), logs)
      return parseFailoverProducerOutput(logs, commandFailed)
    }
    if (arrivalMode === "during-failure") {
      producer = produce()
      // Attach a rejection handler immediately while the fault timer runs.
      void producer.catch(() => {})
      await new Promise((done) => setTimeout(done, 10_000))
    }
    const fault = performance.now()
    await compose("kill", "--signal", "KILL", "app-a")
    report.fault = { service: "app-a", signal: "KILL" }
    const takeover = await waitStatus("app-b", "leader", 90)
    report.leaderStatusAfterFaultMs = performance.now() - fault
    report.pipeline = await (producer ?? produce())
    report.faultToProducerCompletionMs = performance.now() - fault
    report.faultToValidatedDataMs =
      (report.pipeline as { status: string }).status === "passed" ? report.faultToProducerCompletionMs : null
    const rows = await maintenanceDeadline(
      db.query<[{ state: string; result: string }[]]>("SELECT state, result FROM task:`failover-sentinel`;").collect(),
      10_000,
      "Persisted sentinel validation",
    )
    report.persistedSentinel =
      rows[0].length === 1 && rows[0][0].state === "SUCCESS" && rows[0][0].result === "sentinel-result"
    ingress.setBackend(takeover.url || standby.url)
    report.browser = await benchmarkBrowser(ingress.url)
    report.status =
      (report.pipeline as { status: string }).status === "passed" &&
      report.persistedSentinel &&
      (report.browser as { status: string }).status === "passed"
        ? "passed"
        : "failed"
  } catch (error) {
    report.error = String(error)
    report.status = "incomplete"
  } finally {
    await ingress.close()
    if (producer) {
      try {
        await producer
      } catch {
        /* Failure evidence is retained below. */
      }
    }
    try {
      await maintenanceDeadline(db.close(), 5_000, "Failover connection close")
    } catch {
      /* Cleanup still runs. */
    }
    for (const service of ["app-a", "app-b", "database", "broker", "results"]) {
      try {
        await writeFile(resolve(output, `${service}.log`), await compose("logs", "--no-color", service))
      } catch {
        /* A setup failure may precede service creation. */
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
    report.finishedAt = new Date().toISOString()
    await writeFile(resolve(output, "commands.json"), JSON.stringify(commands, null, 2))
    await writeFile(resolve(output, "failover.json"), JSON.stringify(report, null, 2) + "\n")
  }
  return report
}
