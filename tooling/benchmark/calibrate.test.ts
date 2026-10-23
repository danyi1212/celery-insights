// @vitest-environment node
import { expect, test } from "vitest"
import { calibrateNoise } from "./calibrate"
import { compareRuns } from "./compare"
import { comparisonFixture } from "./test-fixtures"

const trials = () =>
  [100, 120, 140, 160, 180].map((p95, index) => {
    const run = comparisonFixture()
    run.runId = `trial-${index}`
    run.pipeline.publication_to_raw_event_live_ms.p95 = p95
    return run
  })

test("empirical noise floors suppress variation without fabricating unsupported percentiles", () => {
  const runs = trials()
  const calibration = calibrateNoise(runs)
  const name = "pipeline.publication_to_raw_event_live_ms.p95"
  expect(calibration.metrics[name]).toMatchObject({ trials: 5, observedRange: 80, median: 140 })
  expect(calibration.metrics["pipeline.publication_to_raw_event_live_ms.p99"].observedRange).toBeNull()
  expect(calibration.budgets.metrics?.["pipeline.publication_to_raw_event_live_ms.p99"]).toBeUndefined()
  expect(compareRuns(runs[0], runs[2], calibration.budgets).rows.find((row) => row.name === name)).toMatchObject({
    threshold: 80,
    status: "within-provisional-budget",
  })
  runs[2].pipeline.publication_to_raw_event_live_ms.p95 = 220
  expect(compareRuns(runs[0], runs[2], calibration.budgets).rows.find((row) => row.name === name)?.status).toBe(
    "flagged",
  )
})

test("calibration rejects insufficient, repeated, failed and incompatible evidence", () => {
  expect(() => calibrateNoise(trials().slice(0, 2))).toThrow("at least five")
  const repeated = trials()
  repeated[4].runId = repeated[0].runId
  expect(() => calibrateNoise(repeated)).toThrow("distinct run IDs")
  for (const change of ["image", "resource", "failed"]) {
    const runs = trials()
    if (change === "image") runs[4].image.id = "sha256:other"
    if (change === "resource") runs[4].containerConfiguration.Memory *= 2
    if (change === "failed") runs[4].status = "failed"
    expect(() => calibrateNoise(runs)).toThrow("valid, compatible")
  }
})

test("old noise floors cannot be reused after a Docker or workload change", () => {
  const runs = trials(),
    calibration = calibrateNoise(runs)
  const baseline = comparisonFixture(),
    candidate = comparisonFixture()
  baseline.environment.docker.ServerVersion = "different-version"
  candidate.environment.docker.ServerVersion = "different-version"
  candidate.pipeline.publication_to_raw_event_live_ms.p95 = 300
  const result = compareRuns(baseline, candidate, calibration.budgets)
  expect(result.status).toBe("incompatible")
  expect(result.flaggedCount).toBe(0)
  expect(result.incompatibilities.some((item) => item.field === "budgets.calibration.seriesKey")).toBe(true)
})
