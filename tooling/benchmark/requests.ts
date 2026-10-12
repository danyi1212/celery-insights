import { benchmarkFetch } from "./ingress"
import assert from "node:assert/strict"

export function distribution(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const quantile = (q: number) => sorted[Math.ceil(sorted.length * q) - 1] ?? null
  return {
    samples: values.length,
    p50: quantile(0.5),
    p95: quantile(0.95),
    p99: values.length >= 1000 ? quantile(0.99) : null,
    max: sorted.at(-1) ?? null,
  }
}

type RequestCase = { name: string; request: () => Promise<{ bytes: number; headersMs: number }> }
export async function arrivalWorkload(cases: RequestCase[], count: number, rate: number, maxInFlight = 32) {
  assert(cases.length && count > 0 && rate > 0 && maxInFlight > 0)
  const started = performance.now()
  const samples: {
    case: string
    scheduleLagMs: number
    scheduledToCompleteMs: number
    responseMs: number
    headersMs: number | null
    bytes: number
    error: string | null
  }[] = []
  const pending = new Set<Promise<void>>()
  const dropped: { case: string; scheduledMs: number }[] = []
  let peakInFlight = 0
  for (let index = 0; index < count; index++) {
    const target = started + (index * 1000) / rate
    const waitMs = target - performance.now()
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs))
    const scenario = cases[index % cases.length]
    if (pending.size >= maxInFlight) {
      dropped.push({ case: scenario.name, scheduledMs: target - started })
      continue
    }
    const requestStart = performance.now()
    const operation = (async () => {
      let result: { bytes: number; headersMs: number } | null = null
      let error = null
      try {
        result = await scenario.request()
      } catch (failure) {
        error = failure instanceof Error ? failure.message : String(failure)
      }
      const end = performance.now()
      samples.push({
        case: scenario.name,
        scheduleLagMs: requestStart - target,
        scheduledToCompleteMs: end - target,
        responseMs: end - requestStart,
        headersMs: result?.headersMs ?? null,
        bytes: result?.bytes ?? 0,
        error,
      })
    })()
    pending.add(operation)
    peakInFlight = Math.max(peakInFlight, pending.size)
    void operation.then(() => pending.delete(operation))
  }
  const publicationMs = performance.now() - started
  await Promise.all(pending)
  const elapsedMs = performance.now() - started
  const successful = samples.filter((sample) => !sample.error)
  const healthy = !dropped.length && samples.every((sample) => sample.scheduleLagMs < 100)
  return {
    status: samples.some((sample) => sample.error) ? "failed" : healthy ? "passed" : "inconclusive",
    offeredRequestsPerSecond: rate,
    plannedRequests: count,
    attemptedRequests: samples.length,
    successfulRequests: successful.length,
    droppedRequests: dropped,
    publicationMs,
    elapsedMs,
    completedGoodputPerSecond: (successful.length * 1000) / elapsedMs,
    generatorHealthy: healthy,
    peakInFlight,
    maxInFlight,
    cases: cases.map(({ name }) => {
      const observations = samples.filter((sample) => sample.case === name)
      const good = observations.filter((sample) => !sample.error)
      return {
        name,
        attempted: observations.length,
        successful: good.length,
        failures: observations.filter((sample) => sample.error),
        successfulResponseMs: distribution(good.map((sample) => sample.responseMs)),
        allAttemptsScheduledToCompleteMs: distribution(observations.map((sample) => sample.scheduledToCompleteMs)),
        headersMs: distribution(good.map((sample) => sample.headersMs!)),
        scheduleLagMs: distribution(observations.map((sample) => sample.scheduleLagMs)),
        responseBytes: good.reduce((total, sample) => total + sample.bytes, 0),
      }
    }),
    samples,
    limitations: [
      "Fixed mixed-request arrival schedule after ingestion; not a sustained or mixed-write capacity result.",
      "Goodput includes bounded drain; timeouts/failures and generator drops are explicit.",
      "Per-case tail estimates with small sample counts are diagnostic, not regression gates.",
    ],
  }
}

function object(value: unknown): Record<string, unknown> {
  assert(value && typeof value === "object" && !Array.isArray(value), "Expected object")
  return value as Record<string, unknown>
}
export function validateToolResponse(text: string, id: number): Record<string, unknown> {
  const rpc = object(JSON.parse(text))
  assert.equal(rpc.id, id, "RPC response ID differs")
  assert(!rpc.error, `RPC error: ${JSON.stringify(rpc.error)}`)
  const result = object(rpc.result)
  assert(!result.isError, `Tool error: ${JSON.stringify(result.content)}`)
  return object(result.structuredContent)
}

export async function benchmarkRequests(
  url: string,
  tasks: number,
  count: number,
  rate: number,
  maxInFlight = 32,
  history = 0,
  extended = false,
) {
  let nextId = 0
  const request = async (path: string, options: RequestInit, validate: (text: string) => void) => {
    const start = performance.now()
    const response = await benchmarkFetch(url + path, { ...options, signal: AbortSignal.timeout(10_000) })
    const headersMs = performance.now() - start
    const bytes = await response.arrayBuffer()
    const text = new TextDecoder().decode(bytes)
    assert(response.ok, `HTTP ${response.status}: ${text.slice(0, 300)}`)
    validate(text)
    return { headersMs, bytes: bytes.byteLength }
  }
  const tool = (name: string, args: Record<string, unknown>, validate: (result: Record<string, unknown>) => void) => {
    const id = ++nextId
    return request(
      "/mcp",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }),
      },
      (text) => validate(validateToolResponse(text, id)),
    )
  }
  const cases: RequestCase[] = [
    {
      name: "http.config",
      request: () =>
        request("/api/config", {}, (text) =>
          assert.equal(object(JSON.parse(text)).observationPath, "/api/observation/rpc"),
        ),
    },
    {
      name: "http.settings-info",
      request: () =>
        request("/api/settings/info", {}, (text) => {
          const result = object(JSON.parse(text))
          assert.equal(result.task_count, tasks + history)
          assert(Number(result.event_count) >= (tasks + history) * 4, "Incomplete raw history")
        }),
    },
    {
      name: "http.metrics",
      request: () =>
        request("/metrics", {}, (text) => {
          assert(text.split("\n").includes(`celery_tasks_total ${tasks + history}`), "Wrong task total")
          assert(
            text.split("\n").includes(`celery_tasks_succeeded_total ${tasks + history - Math.ceil(history / 10)}`),
            "Wrong successful total",
          )
        }),
    },
    {
      name: "mcp.task-overview",
      request: () =>
        tool("inspect_task", { task_id: "bench-0" }, (result) => {
          const task = object(result.task)
          assert.equal(task.task_id, "bench-0")
          assert.equal(task.state, "SUCCESS")
          assert.equal(task.workflow_id, "bench-0")
          const output = object(object(result.output).result)
          assert.equal(output.availability, "available")
          assert(String(output.text).includes("benchmark-result-0"))
        }),
    },
    {
      name: "mcp.task-history",
      request: () =>
        tool("inspect_task", { task_id: "bench-0", section: "history", limit: 10 }, (result) => {
          assert(Array.isArray(result.events))
          assert.deepEqual(result.events.map((entry) => object(entry).event_type).sort(), [
            "task-received",
            "task-sent",
            "task-started",
            "task-succeeded",
          ])
          assert.equal(object(result.page).has_more, false)
        }),
    },
    {
      name: "mcp.workflow-overview",
      request: () =>
        tool("inspect_workflow", { workflow_id: "bench-0" }, (result) => {
          const workflow = object(result.workflow)
          assert.equal(workflow.workflow_id, "bench-0")
          assert.equal(workflow.status, "finished")
          assert.equal(object(workflow.task_counts).total, Math.min(4, tasks))
        }),
    },
  ]
  if (extended) {
    let cursor: string | null = null
    cases.push(
      {
        name: "mcp.discovery",
        request: () => {
          const id = ++nextId
          return request(
            "/mcp",
            {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
              body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/list", params: {} }),
            },
            (text) => {
              const rpc = object(JSON.parse(text))
              assert.equal(rpc.id, id)
              assert(!rpc.error)
              const tools = object(rpc.result).tools
              assert(Array.isArray(tools))
              assert.deepEqual(tools.map((item) => object(item).name).sort(), [
                "inspect_task",
                "inspect_worker",
                "inspect_workflow",
                "list_workers",
                "search_workflows",
              ])
              assert(tools.every((item) => object(object(item).inputSchema).type === "object"))
            },
          )
        },
      },
      {
        name: "mcp.task-history-first-page",
        request: () =>
          tool("inspect_task", { task_id: "bench-0", section: "history", limit: 2 }, (result) => {
            assert(Array.isArray(result.events))
            assert.deepEqual(result.events.map((item) => object(item).event_type).sort(), [
              "task-received",
              "task-sent",
            ])
            const page = object(result.page)
            assert.equal(page.has_more, true)
            assert(typeof page.next_cursor === "string" && page.next_cursor.length > 0)
            cursor ??= page.next_cursor
          }),
      },
      {
        name: "mcp.task-history-next-page",
        request: () => {
          assert(cursor, "Pagination warmup must establish a continuation cursor")
          return tool("inspect_task", { task_id: "bench-0", cursor }, (result) => {
            assert(Array.isArray(result.events))
            assert.deepEqual(result.events.map((item) => object(item).event_type).sort(), [
              "task-started",
              "task-succeeded",
            ])
            assert.equal(object(result.page).has_more, false)
          })
        },
      },
    )
  }
  // Verify all contracts and establish each path before timed repetition.
  const warmupStart = performance.now()
  for (const scenario of cases) {
    try {
      await scenario.request()
    } catch (failure) {
      throw new Error(`${scenario.name} warmup contract failed: ${String(failure)}`)
    }
  }
  const warmupMs = performance.now() - warmupStart
  return { ...(await arrivalWorkload(cases, count, rate, maxInFlight)), warmupRequests: cases.length, warmupMs }
}

/** Stable history contracts remain checkable while the live fixture changes. */
export async function benchmarkConcurrentRequests<T>(
  url: string,
  history: number,
  live: number,
  count: number,
  rate: number,
  maxInFlight: number,
  produce: () => Promise<T>,
) {
  assert(history >= 4, "Concurrent request workload requires at least four historical tasks")
  const observations: { elapsedMs: number; tasks: number; events: number }[] = []
  let started = performance.now(),
    nextId = 0
  const request = async (path: string, init: RequestInit, validate: (text: string) => void) => {
    const start = performance.now()
    const response = await benchmarkFetch(url + path, { ...init, signal: AbortSignal.timeout(10_000) })
    const headersMs = performance.now() - start
    const body = await response.arrayBuffer()
    assert(response.ok, `HTTP ${response.status}`)
    validate(new TextDecoder().decode(body))
    return { bytes: body.byteLength, headersMs }
  }
  const cases: RequestCase[] = [
    {
      name: "http.config",
      request: () =>
        request("/api/config", {}, (text) =>
          assert.equal(object(JSON.parse(text)).observationPath, "/api/observation/rpc"),
        ),
    },
    {
      name: "http.settings-info",
      request: () =>
        request("/api/settings/info", {}, (text) => {
          const result = object(JSON.parse(text))
          const tasks = Number(result.task_count),
            events = Number(result.event_count)
          assert(
            Number.isInteger(tasks) && tasks >= history && tasks <= history + live,
            "Task count outside fixture bounds",
          )
          assert(Number.isInteger(events) && events >= history * 4, "Historical raw coverage lost during writes")
          observations.push({ elapsedMs: performance.now() - started, tasks, events })
        }),
    },
    {
      name: "mcp.historical-task",
      request: () => {
        const id = ++nextId
        return request(
          "/mcp",
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id,
              method: "tools/call",
              params: {
                name: "inspect_task",
                arguments: { task_id: "history-1" },
              },
            }),
          },
          (text) => {
            const result = validateToolResponse(text, id),
              task = object(result.task)
            assert.equal(task.task_id, "history-1")
            assert.equal(task.state, "SUCCESS")
            assert.equal(task.workflow_id, "history-0")
            const output = object(object(result.output).result)
            assert.equal(output.availability, "available")
            assert(String(output.text).includes("history-result-1"), "Historical result changed")
          },
        )
      },
    },
  ]
  const warmup = performance.now()
  try {
    for (const scenario of cases) await scenario.request()
  } catch (error) {
    return { production: await produce(), requests: { status: "failed", stage: "warmup", error: String(error) } }
  }
  const warmupMs = performance.now() - warmup
  observations.length = 0
  started = performance.now()
  const production = produce()
  const requests = await arrivalWorkload(cases, count, rate, maxInFlight)
  const result = await production
  const taskCounts = observations.map((item) => item.tasks)
  const observedWriteProgress = taskCounts.length > 1 && Math.max(...taskCounts) > Math.min(...taskCounts)
  return {
    production: result,
    requests: {
      ...requests,
      warmupRequests: cases.length,
      warmupMs,
      status: requests.status === "passed" && !observedWriteProgress ? "inconclusive" : requests.status,
      observedWriteProgress,
      countObservations: observations,
      limitations: [
        "Fixed HTTP/MCP arrivals overlap real producer execution; changing task counts independently witness write progress.",
        "Stable historical task identity/state/result are validated during writes; changing counts use bounds. Full final correctness is a separate pipeline oracle.",
        "One bounded workload is not sustained API capacity. No write-progress witness makes this scenario inconclusive.",
      ],
    },
  }
}
