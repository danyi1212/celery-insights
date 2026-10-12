import { benchmarkIngress } from "./ingress"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { randomUUID, createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { resourceSnapshotScript, resourceDelta, type ResourceSnapshot } from "./resources"

const execute = promisify(execFile)
export function summarizeCeleryPairs(attempts: Record<string, unknown>[], repetitions: number) {
  const pairs = Array.from({ length: repetitions }, (_, index) => {
    const matching = attempts.filter((attempt) => attempt.pair === index + 1)
    const baseline = matching.find((attempt) => attempt.monitored === false)
    const monitored = matching.find((attempt) => attempt.monitored === true)
    const pipeline = (attempt: Record<string, unknown> | undefined) =>
      attempt?.pipeline as Record<string, unknown> | undefined
    const valid =
      matching.length === 2 &&
      baseline?.status === "passed" &&
      monitored?.status === "passed" &&
      pipeline(baseline)?.generator_healthy === true &&
      pipeline(monitored)?.generator_healthy === true &&
      (pipeline(monitored)?.persisted as { passed?: boolean } | undefined)?.passed === true
    const latency = (attempt: Record<string, unknown> | undefined, key: string) =>
      (pipeline(attempt)?.task_completion_ms as Record<string, unknown> | undefined)?.[key]
    const metric = (left: unknown, right: unknown) => {
      const supported =
        valid &&
        typeof left === "number" &&
        Number.isFinite(left) &&
        left >= 0 &&
        typeof right === "number" &&
        Number.isFinite(right) &&
        right >= 0
      return {
        baseline: supported ? left : null,
        monitored: supported ? right : null,
        delta: supported ? right - left : null,
        relativeDelta: supported && left > 0 ? (right - left) / left : null,
      }
    }
    return {
      pair: index + 1,
      status: valid ? "valid" : "unavailable",
      metrics: {
        completionP50Ms: metric(latency(baseline, "p50"), latency(monitored, "p50")),
        completionP95Ms: metric(latency(baseline, "p95"), latency(monitored, "p95")),
        goodputTasksPerSecond: metric(
          pipeline(baseline)?.completed_task_goodput_per_second,
          pipeline(monitored)?.completed_task_goodput_per_second,
        ),
        workerCpuSeconds: metric(
          (baseline?.workerResources as { cpuSeconds?: number } | undefined)?.cpuSeconds,
          (monitored?.workerResources as { cpuSeconds?: number } | undefined)?.cpuSeconds,
        ),
      },
    }
  })
  return {
    pairs,
    validPairs: pairs.filter((pair) => pair.status === "valid").length,
    policy:
      "Diagnostic paired deltas, not a timing gate. Failed/incomplete/unhealthy pairs have unavailable deltas; repetitions and observation overhead must be considered.",
  }
}

export async function benchmarkCelery(image: string, output: string, repetitions: number) {
  await mkdir(dirname(resolve(output)), { recursive: true })
  await mkdir(output)
  const ingress = await benchmarkIngress(output)
  const inspection = JSON.parse((await execute("docker", ["image", "inspect", image])).stdout)[0]
  const report: Record<string, unknown> = {
    schemaVersion: 1,
    status: "incomplete",
    startedAt: new Date().toISOString(),
    image: { reference: image, id: inspection.Id, architecture: inspection.Architecture },
    sourceSha: (await execute("git", ["rev-parse", "HEAD"])).stdout.trim(),
    sourceStatus: (await execute("git", ["status", "--porcelain"])).stdout,
    workload: {
      tasks: 128,
      offeredTasksPerSecond: 20,
      cpuIterations: 250000,
      workerCpus: 1,
      workerMemory: "512m",
      workerConcurrency: 2,
      monitorQueuesExclusive: true,
    },
    harness: Object.fromEntries(
      await Promise.all(
        ["celery.ts", "celery_workload.py", "pipeline.py", "resources.ts"].map(async (file) => [
          file,
          createHash("sha256")
            .update(await readFile(new URL(file, import.meta.url)))
            .digest("hex"),
        ]),
      ),
    ),
    attempts: [],
    limitations: [
      "Paired runs alternate monitoring order on this host. Dependencies/storage are fresh per attempt; images are cached.",
      "Monitoring enables Celery lifecycle/sent events and adds Insights ingestion/polling. STARTED backend writes and deterministic work match.",
      "Worker completion latency includes controller Redis polling; resource brackets include producer startup, post-work validation and collectors.",
      "One worker and 128 small CPU tasks are a bounded overhead case, not a production worker/poller-cardinality capacity recommendation.",
    ],
  }
  const attempts = report.attempts as Record<string, unknown>[]
  const save = () => writeFile(resolve(output, "celery.json"), JSON.stringify(report, null, 2) + "\n")
  await save()
  try {
    for (let pair = 1; pair <= repetitions; pair++) {
      for (const monitored of pair % 2 === 1 ? [false, true] : [true, false]) {
        const name = `pair-${pair}-${monitored ? "monitored" : "baseline"}`
        const directory = resolve(output, name)
        await mkdir(directory)
        const project = `ci-celery-${randomUUID().slice(0, 8)}`
        const environment = {
          BROKER_URL: "amqp://benchmark:benchmark@broker/",
          RESULT_BACKEND: "redis://results:6379/0",
          BENCH_MONITORED: String(monitored),
          PYTHONPATH: "/app:/benchmark",
          BENCH_DB_URL: "ws://127.0.0.1:8557/rpc",
          BENCH_WRITER_PASSWORD: "benchmark-ingester",
        }
        const services: Record<string, unknown> = {
          broker: {
            image: "rabbitmq:4.3.6-management-alpine",
            environment: { RABBITMQ_DEFAULT_USER: "benchmark", RABBITMQ_DEFAULT_PASS: "benchmark" },
            healthcheck: {
              test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"],
              interval: "2s",
              timeout: "5s",
              retries: 30,
            },
          },
          results: {
            image: "redis:8.10.2-alpine",
            healthcheck: { test: ["CMD", "redis-cli", "ping"], interval: "2s", timeout: "2s", retries: 30 },
          },
          worker: {
            image,
            cpus: 1,
            mem_limit: "512m",
            entrypoint: ["python", "/benchmark/tooling/benchmark/celery_workload.py", "worker"],
            environment,
            volumes: [`${process.cwd()}:/benchmark:ro`],
          },
          producer: {
            image,
            ...(monitored ? { network_mode: "service:app", depends_on: ["app"] } : {}),
            entrypoint: ["python", "/benchmark/tooling/benchmark/celery_workload.py", "measure"],
            environment,
            volumes: [`${process.cwd()}:/benchmark:ro`],
          },
        }
        if (monitored)
          services.app = {
            image,
            cpus: 2,
            mem_limit: "2g",
            environment: {
              ...environment,
              CELERY_INSIGHTS_CONFIG_FILE: "/benchmark-auth/authentication.toml",
              SURREALDB_STORAGE: "rocksdb:///data/store",
              SEARCH_INDEXING_ENABLED: "false",
              CELERY_INSIGHTS_DATABASE_ROOT_PASSWORD: "benchmark-root",
              SURREALDB_INGESTER_PASS: "benchmark-ingester",
              LOG_FORMAT: "json",
              CLEANUP_INTERVAL_SECONDS: "86400",
            },
            volumes: ["data:/data", `${ingress.directory}:/benchmark-auth:ro`],
          }
        const composeFile = resolve(directory, "compose.json")
        await writeFile(composeFile, JSON.stringify({ services, volumes: { data: {} } }, null, 2))
        const commands: unknown[] = []
        const compose = async (...args: string[]) => {
          const started = performance.now()
          try {
            const result = await execute("docker", ["compose", "-f", composeFile, "-p", project, ...args], {
              timeout: 150_000,
              maxBuffer: 16 * 1024 * 1024,
            })
            commands.push({ args, code: 0, durationMs: performance.now() - started })
            return { ...result, code: 0 }
          } catch (error) {
            const failure = error as { stdout?: string; stderr?: string; code?: unknown }
            commands.push({ args, code: failure.code ?? 1, durationMs: performance.now() - started })
            return { stdout: failure.stdout ?? "", stderr: failure.stderr ?? String(error), code: failure.code ?? 1 }
          }
        }
        const required = async (args: string[]) => {
          const result = await compose(...args)
          if (result.code !== 0) throw new Error(result.stderr)
          return result.stdout
        }
        const snapshot = async (service: string): Promise<ResourceSnapshot> => {
          if (service === "worker" || service === "app")
            return JSON.parse(await required(["exec", "-T", service, "python", "-c", resourceSnapshotScript]))
          // Broker/backend images have no Python. Read only their native cgroup counters.
          const result = await compose(
            "exec",
            "-T",
            service,
            "cat",
            "/sys/fs/cgroup/cpu.stat",
            "/sys/fs/cgroup/memory.current",
            "/sys/fs/cgroup/memory.peak",
            "/sys/fs/cgroup/cpu.max",
          )
          const lines = result.stdout.trim().split("\n")
          const available = result.code === 0 && lines.length >= 4
          return {
            monotonicSeconds: performance.now() / 1000,
            clockTicksPerSecond: 1,
            cpuStat: available
              ? Object.fromEntries(
                  lines.slice(0, -3).map((line) => {
                    const [key, value] = line.split(/\s+/)
                    return [key, Number(value)]
                  }),
                )
              : null,
            cpuMax: available ? lines.at(-1)! : null,
            memoryCurrentBytes: available ? lines.at(-3)! : null,
            memoryPeakBytes: available ? lines.at(-2)! : null,
            memoryStat: null,
            memoryEvents: null,
            ioStat: null,
            processes: [],
          }
        }
        const started = performance.now()
        const attempt: Record<string, unknown> = { pair, monitored, project, status: "incomplete" }
        try {
          await required(["up", "-d", "--wait", "broker", "results"])
          if (monitored) await required(["up", "-d", "--wait", "app"])
          await required(["up", "-d", "worker"])
          const observedServices = ["worker", "broker", "results", ...(monitored ? ["app"] : [])]
          const before = Object.fromEntries(
            await Promise.all(observedServices.map(async (service) => [service, await snapshot(service)])),
          )
          const measured = await compose("run", "--rm", "-T", "producer")
          await writeFile(resolve(directory, "producer.stdout"), measured.stdout)
          await writeFile(resolve(directory, "producer.stderr"), measured.stderr)
          if (!measured.stdout.trim())
            throw new Error(`Producer failed before emitting a result: ${measured.stderr.slice(-1200)}`)
          const result = JSON.parse(measured.stdout.trim().split("\n").at(-1) ?? "null")
          if (!result || !["passed", "failed", "inconclusive"].includes(result.status))
            throw new Error("Producer returned no valid result")
          if (measured.code !== 0 && result.status === "passed")
            throw new Error("Producer exited unsuccessfully despite reporting success")
          const after = Object.fromEntries(
            await Promise.all(observedServices.map(async (service) => [service, await snapshot(service)])),
          )
          attempt.resources = Object.fromEntries(
            observedServices.map((service) => [service, resourceDelta(before[service], after[service])]),
          )
          attempt.workerResources = (attempt.resources as Record<string, unknown>).worker
          attempt.pipeline = result
          attempt.status = result.status
        } catch (error) {
          attempt.error = String(error)
        } finally {
          for (const service of ["worker", "broker", "results", ...(monitored ? ["app"] : [])]) {
            const logs = await compose("logs", "--no-color", service)
            await writeFile(resolve(directory, `${service}.log`), logs.stdout + logs.stderr)
          }
          const cleanup = await compose("down", "-v", "--remove-orphans")
          attempt.cleanedUp = cleanup.code === 0
          if (!attempt.cleanedUp) attempt.status = "incomplete"
          attempt.controllerMs = performance.now() - started
          await writeFile(resolve(directory, "commands.json"), JSON.stringify(commands, null, 2))
          attempts.push(attempt)
          report.comparison = summarizeCeleryPairs(attempts, repetitions)
          await save()
        }
      }
    }
  } finally {
    await ingress.close()
  }
  report.status = attempts.every((attempt) => attempt.status === "passed")
    ? "passed"
    : attempts.some((attempt) => attempt.status === "failed")
      ? "failed"
      : "incomplete"
  report.finishedAt = new Date().toISOString()
  await save()
  return report
}
