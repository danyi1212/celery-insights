// @vitest-environment node
import { expect, test } from "vitest"
import { resourceTrend, type ResourceSnapshot } from "./resources"

const snapshot = (seconds: number, memory: string | null): ResourceSnapshot => ({
  monotonicSeconds: seconds,
  clockTicksPerSecond: 100,
  cpuStat: { usage_usec: seconds * 100_000 },
  cpuMax: "100000 100000",
  memoryCurrentBytes: memory,
  memoryPeakBytes: memory,
  memoryStat: { anon: seconds * 5 },
  memoryEvents: null,
  ioStat: null,
  processes: [],
})

test("resource trends exclude startup spikes and use elapsed time rather than sample index", () => {
  const result = resourceTrend([snapshot(0, "1000000"), snapshot(30, "300"), snapshot(45, "450"), snapshot(90, "900")])
  expect(result).toMatchObject({
    status: "observed",
    totalSamples: 4,
    steadySamples: 3,
    durationSeconds: 60,
    sampledPeakMemoryBytes: 900,
    memoryBytesPerSecond: 10,
    anonymousBytesPerSecond: 5,
  })
  expect(result.steadyResources?.averageCpuCores).toBeCloseTo(0.1)
})

test("missing counters and insufficient observation never become a zero-growth claim", () => {
  const missing = resourceTrend([snapshot(0, "0"), snapshot(30, "300"), snapshot(45, null), snapshot(90, "900")])
  expect(missing.memoryBytesPerSecond).toBeNull()
  const short = resourceTrend([snapshot(0, "0"), snapshot(30, "300"), snapshot(40, "400")])
  expect(short.status).toBe("insufficient-samples")
  expect(short.memoryBytesPerSecond).toBeNull()
})
