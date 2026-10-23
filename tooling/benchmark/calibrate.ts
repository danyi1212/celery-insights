import { comparisonSeriesKey, compareRuns, extractMetrics, provisionalBudgets, type Budgets } from "./compare"

export function calibrateNoise(runs: unknown[]) {
  if (runs.length < 5) throw new Error("Noise calibration requires at least five independent trials")
  const value = (run: unknown) => {
    if (run === null || typeof run !== "object" || Array.isArray(run)) throw new Error("Invalid calibration result")
    return run as Record<string, unknown>
  }
  const series = comparisonSeriesKey(runs[0])
  const image = JSON.stringify(value(runs[0]).image)
  const ids = new Set(runs.map((run) => value(run).runId))
  if (ids.size !== runs.length || [...ids].some((id) => typeof id !== "string" || !id))
    throw new Error("Calibration trials must have distinct run IDs")
  if (
    !series ||
    runs.some(
      (run) =>
        comparisonSeriesKey(run) !== series ||
        compareRuns(run, run).status !== "report-only" ||
        JSON.stringify(value(run).image) !== image,
    )
  )
    throw new Error("Calibration requires valid, compatible measurements of the same image")
  const extracted = runs.map(extractMetrics)
  const budgets: Budgets = {
    ...provisionalBudgets,
    metrics: {},
    calibration: { seriesKey: series, trials: runs.length, runIds: [...ids] as string[] },
  }
  const metrics = Object.fromEntries(
    Object.entries(extracted[0]).map(([name, metric]) => {
      const values = extracted.map((run) => run[name]?.value ?? null)
      const valid = values.every((sample) => sample !== null)
      const sorted = valid ? (values as number[]).sort((a, b) => a - b) : []
      const observedRange = valid ? sorted.at(-1)! - sorted[0] : null
      if (observedRange !== null)
        budgets.metrics![name] = {
          relative: provisionalBudgets.relative,
          absolute: provisionalBudgets.absolute[metric.unit],
          noiseFloor: observedRange,
        }
      return [
        name,
        {
          trials: runs.length,
          supportedTrials: values.filter((sample) => sample !== null).length,
          minimum: sorted[0] ?? null,
          maximum: sorted.at(-1) ?? null,
          median: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
          observedRange,
          unit: metric.unit,
        },
      ]
    }),
  )
  return {
    schemaVersion: 1,
    seriesKey: series,
    runIds: [...ids],
    metrics,
    budgets,
    limitations: [
      "Observed ranges are empirical calibration, not confidence bounds or a guarantee about future noise.",
      "No timing gate is enabled. Confirm suspect changes with controlled baseline/candidate repetitions.",
      "Same-image and recorded compatibility do not prove an uncontended runner.",
    ],
  }
}
