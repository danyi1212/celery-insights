// @vitest-environment node
import { describe, expect, test } from "vitest"
import { arrivalWorkload, distribution, validateToolResponse } from "./requests"
import { layoutShiftScore } from "./browser"
import { resourceDelta, type ResourceSnapshot } from "./resources"
import { expectedHistoryCounts, idFingerprint, validateExplorerResponse, validateReturnedRows } from "./queries"

describe("benchmark measurement contracts", () => {
  test("slow responses do not reduce offered arrivals", async () => {
    let active = 0
    let peak = 0
    const result = await arrivalWorkload(
      [
        {
          name: "slow",
          request: async () => {
            active++
            peak = Math.max(peak, active)
            await new Promise((resolve) => setTimeout(resolve, 100))
            active--
            return { bytes: 1, headersMs: 100 }
          },
        },
      ],
      8,
      100,
    )
    expect(peak).toBeGreaterThan(3)
    expect(result.attemptedRequests).toBe(8)
    expect(result.successfulRequests).toBe(8)
    expect(result.cases[0].allAttemptsScheduledToCompleteMs.p50).toBeGreaterThan(90)
  })

  test("a saturated generator reports dropped work as inconclusive", async () => {
    const result = await arrivalWorkload(
      [
        {
          name: "bounded",
          request: async () => {
            await new Promise((resolve) => setTimeout(resolve, 100))
            return { bytes: 1, headersMs: 100 }
          },
        },
      ],
      8,
      100,
      1,
    )
    expect(result.status).toBe("inconclusive")
    expect(result.droppedRequests.length).toBeGreaterThan(0)
    expect(result.attemptedRequests + result.droppedRequests.length).toBe(result.plannedRequests)
  })

  test("failed responses remain in outcomes and scheduled-completion samples", async () => {
    const result = await arrivalWorkload(
      [
        {
          name: "wrong-content",
          request: async () => {
            throw new Error("Incorrect result")
          },
        },
      ],
      2,
      100,
    )
    expect(result.status).toBe("failed")
    expect(result.successfulRequests).toBe(0)
    expect(result.cases[0].failures.length).toBe(2)
    expect(result.cases[0].successfulResponseMs.p50).toBeNull()
    expect(result.cases[0].allAttemptsScheduledToCompleteMs.samples).toBe(2)
  })

  test("MCP errors inside a successful HTTP response fail validation", () => {
    expect(() => validateToolResponse(JSON.stringify({ id: 1, result: { isError: true, content: [] } }), 1)).toThrow(
      "Tool error",
    )
    expect(() => validateToolResponse(JSON.stringify({ id: 2, result: { structuredContent: {} } }), 1)).toThrow(
      "RPC response ID differs",
    )
    expect(() => validateToolResponse(JSON.stringify({ id: 1, error: { message: "timeout" } }), 1)).toThrow("RPC error")
  })

  test("layout shift uses the largest session window and excludes recent input", () => {
    const entry = (startTime: number, value: number, hadRecentInput = false) => ({
      name: "",
      entryType: "layout-shift",
      duration: 0,
      startTime,
      value,
      hadRecentInput,
    })
    expect(layoutShiftScore([entry(100, 0.1), entry(800, 0.2), entry(900, 1, true), entry(2000, 0.2)])).toBeCloseTo(0.3)
    const longSession = Array.from({ length: 7 }, (_, index) => entry(index * 900, 0.1))
    expect(layoutShiftScore(longSession)).toBeCloseTo(0.6)
    expect(layoutShiftScore([entry(100, 0.1), entry(1100, 0.2)])).toBeCloseTo(0.2)
  })

  test("empty samples are unavailable and tiny samples do not imply p99", () => {
    expect(distribution([]).p95).toBeNull()
    expect(distribution([1, 2, 3]).p99).toBeNull()
  })

  test("resource counters preserve unavailable data and do not attribute reused PIDs", () => {
    const before: ResourceSnapshot = {
      monotonicSeconds: 1,
      clockTicksPerSecond: 100,
      cpuStat: { usage_usec: 1_000_000, nr_periods: 10, nr_throttled: 1 },
      cpuMax: "200000 100000",
      memoryCurrentBytes: "1000",
      memoryPeakBytes: "2000",
      memoryStat: { inactive_file: 100 },
      memoryEvents: null,
      ioStat: null,
      processes: [{ pid: 7, name: "surreal", userTicks: 100, systemTicks: 0, startTicks: 1, rssBytes: 500 }],
    }
    const after: ResourceSnapshot = {
      ...before,
      monotonicSeconds: 3,
      cpuStat: { usage_usec: 3_000_000, nr_periods: 20, nr_throttled: 5 },
      processes: [{ ...before.processes[0], userTicks: 300, startTicks: 2 }],
    }
    const summary = resourceDelta(before, after)
    expect(summary.cpuSeconds).toBe(2)
    expect(summary.averageCpuCores).toBe(1)
    expect(summary.throttledPeriods).toBe(4)
    expect(summary.throttledSeconds).toBeNull()
    expect(summary.processes[0].cpuSeconds).toBeNull()
    expect(resourceDelta({ ...before, cpuStat: null }, after).cpuSeconds).toBeNull()
  })

  test("retained ID fingerprints detect substitution despite matching record counts", () => {
    expect(idFingerprint(["history-1", "history-0"])).toBe(idFingerprint(["history-0", "history-1"]))
    expect(idFingerprint(["history-0", "history-wrong"])).not.toBe(idFingerprint(["history-0", "history-1"]))
    expect(expectedHistoryCounts(5)).toEqual({ tasks: 5, events: 20, workflows: 2, failures: 1, failureWorkflows: 1 })
  })

  test("a query can fail correctness despite plausible rows and counts", () => {
    const parts = [
      [{ id: "task:history-1" }],
      [{ count: 1 }],
      [{ state: "SUCCESS", count: 1 }],
      [{ type: "history.work.1", count: 1 }],
      [{ worker: "history-worker-1", count: 1 }],
      [{ bucket: "fixture", count: 2 }],
    ]
    expect(() => validateExplorerResponse(parts, 0, "tasks", 1, 50)).toThrow("Histogram differs")
    expect(() =>
      validateReturnedRows(
        [{ id: "task:history-1", state: "SUCCESS", type: "history.work.1", workflow_id: "history-0" }],
        "tasks.failure",
        5,
        0,
      ),
    ).toThrow("Wrong failure selection")
    expect(() => validateReturnedRows([{ id: "task:history-999" }], "tasks.all", 5, 0)).toThrow(
      "Fixture ID outside manifest",
    )
  })
})
