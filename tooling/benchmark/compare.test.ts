// @vitest-environment node
import { expect, test } from "vitest"
import { compareRuns, comparisonMarkdown, provisionalBudgets } from "./compare"

import { comparisonFixture as fixture } from "./test-fixtures"

test("a deliberate slowdown is flagged as report-only; application changes remain comparable", () => {
  const baseline = fixture(),
    candidate = fixture()
  candidate.runId = "candidate"
  candidate.sourceSha = "b".repeat(40)
  candidate.image.id = "sha256:candidate"
  candidate.scenario.history.referenceTime = "2026-10-11T10:00:00Z"
  Object.assign(candidate.harness.files, {
    "runtime/observation/queries.ts": "changed-app-query",
    "bun.lock": "changed-app-dependencies",
  })
  candidate.pipeline.publication_to_raw_event_live_ms.p95 = 150
  const report = compareRuns(baseline, candidate)
  expect(report.status).toBe("report-only")
  expect(report.incompatibilities).toEqual([])
  expect(report.rows.find((row) => row.name.endsWith("live_ms.p95"))).toMatchObject({
    status: "flagged",
    delta: 50,
    threshold: 15,
  })
  expect(report.flaggedCount).toBe(1)
  expect(comparisonMarkdown(report)).toContain("report-only")
})

test.each(["storage", "resources", "harness", "runner", "metadata", "reader", "notifications"])(
  "%s changes block misleading timing comparisons",
  (kind) => {
    const baseline = fixture(),
      candidate = fixture()
    if (kind === "reader") candidate.scenario.readerMode = "none"
    if (kind === "notifications") candidate.applicationConfiguration.SURREAL_WEBSOCKET_RESPONSE_CHANNEL_SIZE = "1024"
    if (kind === "storage") candidate.applicationConfiguration.SURREALDB_STORAGE = "surrealkv:///data/store"
    if (kind === "resources") candidate.containerConfiguration.Memory *= 2
    if (kind === "harness") candidate.harness.files["tooling/benchmark/browser.ts"] = "new-journey"
    if (kind === "runner") candidate.environment.cpuModel = "different cpu"
    if (kind === "metadata") Reflect.deleteProperty(candidate.environment, "runnerClass")
    candidate.pipeline.publication_to_raw_event_live_ms.p95 = 200
    const report = compareRuns(baseline, candidate)
    expect(report.status).toBe("incompatible")
    expect(report.incompatibilities.length).toBeGreaterThan(0)
    expect(report.flaggedCount).toBe(0)
    expect(report.rows.every((row) => row.delta === null && row.status === "not-compared")).toBe(true)
  },
)

test("failed or unhealthy outcomes never become faster passing baselines", () => {
  const baseline = fixture(),
    candidate = fixture()
  candidate.pipeline.generator_healthy = false
  candidate.pipeline.publication_to_raw_event_live_ms.p95 = 1
  expect(compareRuns(baseline, candidate)).toMatchObject({ status: "candidate-failed", flaggedCount: 0 })
  baseline.status = "incomplete"
  expect(compareRuns(baseline, candidate).status).toBe("unusable-baseline")
})

test("unavailable percentiles remain unavailable, and a zero baseline does not divide by zero", () => {
  const baseline = fixture(),
    candidate = fixture()
  baseline.pipeline.publication_to_raw_event_live_ms.p95 = 0
  candidate.pipeline.publication_to_raw_event_live_ms.p95 = 10
  const report = compareRuns(baseline, candidate)
  expect(report.rows.find((row) => row.name.endsWith("live_ms.p99"))).toMatchObject({
    status: "unavailable",
    delta: null,
  })
  expect(report.rows.find((row) => row.name.endsWith("live_ms.p95"))).toMatchObject({
    status: "flagged",
    delta: 10,
    relativeDelta: null,
  })
})

test("old metadata and missing absolute budgets are rejected explicitly", () => {
  const old = fixture()
  old.schemaVersion = 2
  expect(compareRuns(old, fixture()).status).toBe("incompatible")
  const budgets = structuredClone(provisionalBudgets)
  Reflect.deleteProperty(budgets.absolute, "bytes")
  expect(() => compareRuns(fixture(), fixture(), budgets)).toThrow("Invalid comparison budgets")
})

test("goodput uses the higher-is-better direction", () => {
  const baseline = fixture(),
    candidate = fixture()
  for (const run of [baseline, candidate]) {
    Object.assign(run.scenario, { requests: { count: 120, rate: 40, maxInFlight: 32 } })
    Object.assign(run, {
      requests: {
        status: "passed",
        generatorHealthy: true,
        successfulRequests: 120,
        completedGoodputPerSecond: run === baseline ? 40 : 20,
        cases: [],
      },
    })
  }
  const report = compareRuns(baseline, candidate)
  expect(report.rows.find((row) => row.name === "requests.completedGoodput")).toMatchObject({
    direction: "higher",
    status: "flagged",
    delta: -20,
  })
})

test("duplicate named query metrics cannot silently replace earlier evidence", () => {
  const run = fixture()
  Object.assign(run.scenario, { queries: { repetitions: 3 } })
  Object.assign(run, {
    queries: {
      status: "passed",
      cases: [
        { name: "tasks.all", medianMs: 5, samplesMs: [5] },
        { name: "tasks.all", medianMs: 1, samplesMs: [1] },
      ],
    },
  })
  expect(() => compareRuns(run, run)).toThrow("Duplicate metric")
})

test.each(["incomplete", "inconclusive"])("%s candidate remains a distinct visible outcome", (status) => {
  const candidate = fixture()
  candidate.status = status
  const report = compareRuns(fixture(), candidate)
  expect(report.status).toBe(`candidate-${status}`)
  expect(report.rows.every((row) => row.delta === null)).toBe(true)
})

test("active browser failure prevents a valid reference even when ingestion passes", () => {
  const run = fixture()
  run.scenario.liveBrowser = true
  Object.assign(run, { liveBrowser: { status: "failed", version: "test", profile: { query: "bench-" } } })
  const report = compareRuns(run, run)
  expect(report.status).not.toBe("report-only")
  expect(report.candidateProblems).toContain("liveBrowser did not pass")
})

test("a concurrent API run requires independent write progress and a healthy generator", () => {
  const baseline = fixture(),
    candidate = fixture()
  for (const run of [baseline, candidate]) {
    Object.assign(run.scenario, { concurrentRequests: { count: 12, rate: 5, maxInFlight: 32, mixVersion: 1 } })
    Object.assign(run, {
      concurrentRequests: {
        status: "passed",
        generatorHealthy: true,
        observedWriteProgress: true,
        successfulRequests: 12,
        completedGoodputPerSecond: 5,
        cases: [],
      },
    })
  }
  expect(compareRuns(baseline, candidate).status).toBe("report-only")
  Object.assign(Reflect.get(candidate, "concurrentRequests"), { observedWriteProgress: false })
  expect(compareRuns(baseline, candidate).status).toBe("candidate-failed")
})

test("a checkpoint without finalized cleanup cannot become a passing reference", () => {
  const baseline = fixture(),
    candidate = fixture()
  Reflect.deleteProperty(candidate, "cleanup")
  expect(compareRuns(baseline, candidate).status).toBe("candidate-failed")
  Object.assign(candidate, { cleanup: { status: "failed", commandCode: 1 } })
  expect(compareRuns(baseline, candidate).status).toBe("candidate-failed")
})

test("fan-out timing cannot pass when one subscriber lost events", () => {
  const baseline = fixture(),
    candidate = fixture()
  for (const run of [baseline, candidate]) {
    Object.assign(run.scenario, { liveClients: 2, slowClientDelayMs: 0 })
    Object.assign(run.pipeline, {
      fanout: {
        clients: 2,
        observations: [
          { client: 1, raw_events: 128 },
          { client: 2, raw_events: 128 },
        ],
      },
    })
  }
  expect(compareRuns(baseline, candidate).status).not.toBe("candidate-failed")
  Reflect.get(candidate.pipeline, "fanout").observations[1].raw_events = 127
  expect(compareRuns(baseline, candidate).status).toBe("candidate-failed")
})

test("partial private LIVE diagnostics cannot look faster when public refresh converges", () => {
  const baseline = fixture(),
    candidate = fixture()
  candidate.runId = "candidate"
  candidate.pipeline.private_live.complete = false
  candidate.pipeline.publication_to_raw_event_live_ms.p95 = 1
  const report = compareRuns(baseline, candidate)
  expect(report.status).toBe("report-only")
  expect(report.rows.find((row) => row.name === "pipeline.publication_to_raw_event_live_ms.p95")).toMatchObject({
    status: "unavailable",
    delta: null,
  })
})
