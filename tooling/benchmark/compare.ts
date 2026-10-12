import { createHash } from "node:crypto"

type ObjectValue = Record<string, unknown>
type Unit = "ms" | "s" | "bytes" | "cpu-s" | "requests/s" | "score"
type Metric = { value: number | null; unit: Unit; direction: "lower" | "higher"; samples: number | null }
export type Budgets = {
  relative: number
  absolute: Record<Unit, number>
  metrics?: Record<string, { relative: number; absolute: number; noiseFloor: number }>
  calibration?: { seriesKey: string; trials: number; runIds: string[] }
}
export const provisionalBudgets: Budgets = {
  relative: 0.15,
  absolute: { ms: 5, s: 0.05, bytes: 1024, "cpu-s": 0.05, "requests/s": 1, score: 0.01 },
}
const object = (value: unknown): value is ObjectValue =>
  typeof value === "object" && value !== null && !Array.isArray(value)
const get = (value: unknown, ...path: string[]): unknown => {
  for (const part of path) value = object(value) ? value[part] : undefined
  return value
}
const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null)
const list = (value: unknown): ObjectValue[] => (Array.isArray(value) ? value.filter(object) : [])
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (object(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`
  return JSON.stringify(value) ?? "undefined"
}

function contract(run: unknown) {
  const scenario = get(run, "scenario")
  const history = get(scenario, "history")
  const normalizedScenario = object(scenario)
    ? { ...scenario, history: object(history) ? { ...history, referenceTime: undefined } : history }
    : undefined
  const fields: ObjectValue = {
    schemaVersion: get(run, "schemaVersion"),
    executionContractVersion: get(run, "executionContractVersion"),
    scenario: normalizedScenario,
    runnerClass: get(run, "environment", "runnerClass"),
    platform: get(run, "environment", "platform"),
    architecture: get(run, "environment", "architecture"),
    cpuModel: get(run, "environment", "cpuModel"),
    cpuCount: get(run, "environment", "cpuCount"),
    docker: get(run, "environment", "docker"),
    imageArchitecture: get(run, "image", "architecture"),
    controllerBun: get(run, "harness", "bunVersion"),
    applicationConfiguration: get(run, "applicationConfiguration"),
    transport: get(run, "transport"),
    observationContract: get(run, "pipeline", "measurement_contract"),
    pipelineFixtureVersion: get(run, "pipeline", "fixture", "version"),
  }
  for (const file of [
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
  ])
    fields[`harness.${file}`] = get(run, "harness", "files", `tooling/benchmark/${file}`)
  for (const key of ["NanoCpus", "Memory", "MemorySwap", "CpuQuota", "CpuPeriod", "CpusetCpus"])
    fields[`resource.${key}`] = get(run, "containerConfiguration", key)
  for (const key of ["SURREALDB_STORAGE", "SEARCH_INDEXING_ENABLED", "SURREAL_WEBSOCKET_RESPONSE_CHANNEL_SIZE"])
    fields[`application.${key}`] = get(run, "applicationConfiguration", key)
  for (const service of ["broker", "results"])
    fields[`dependency.${service}`] = get(run, "environment", "serviceImages", service)
  for (const key of ["OperatingSystem", "OSType", "Architecture", "NCPU", "MemTotal", "KernelVersion", "ServerVersion"])
    fields[`docker.${key}`] = get(run, "environment", "docker", key)
  for (const key of [
    "tasks",
    "rate",
    "readerMode",
    "resultBytes",
    "dropSequence",
    "requests",
    "concurrentRequests",
    "browser",
    "liveBrowser",
    "restart",
    "maintenance",
    "resourceIntervalSeconds",
    "burst",
    "artifacts",
    "queries",
  ])
    fields[`scenario.${key}`] = get(scenario, key)
  for (const key of ["tasks", "payloadBytes", "setupDeadlineSeconds"])
    fields[`scenario.history.${key}`] = get(history, key)
  if (number(get(history, "tasks"))) fields.historyFixtureVersion = get(run, "history", "fixture_version")
  if (get(scenario, "browser")) {
    fields.browserVersion = get(run, "browser", "version")
    fields.browserProfile = get(run, "browser", "profile")
  }
  if (get(scenario, "liveBrowser")) {
    fields.liveBrowserVersion = get(run, "liveBrowser", "version")
    fields.liveBrowserProfile = get(run, "liveBrowser", "profile")
  }
  if (get(scenario, "artifacts")) fields.compression = get(run, "artifacts", "compression")
  return fields
}

export function comparisonSeriesKey(run: unknown): string | null {
  const fields = contract(run)
  if (
    get(run, "schemaVersion") !== 3 ||
    get(run, "executionContractVersion") !== 1 ||
    Object.values(fields).some((value) => value === undefined)
  )
    return null
  return createHash("sha256").update(canonical(fields)).digest("hex")
}

function outcomeProblems(run: unknown) {
  const problems: string[] = []
  if (get(run, "status") !== "passed") problems.push(`Run status is ${String(get(run, "status"))}`)
  if (get(run, "cleanup", "status") !== "passed") problems.push("Private benchmark cleanup did not complete")
  if (
    get(run, "pipeline", "status") !== "passed" ||
    get(run, "pipeline", "generator_healthy") !== true ||
    get(run, "pipeline", "persisted_correctness", "passed") !== true ||
    get(run, "pipeline", "live_delivery_complete") !== true
  )
    problems.push("Pipeline correctness, generator health, or complete LIVE delivery is not proven")
  const clients = number(get(run, "scenario", "liveClients"))
  if (clients !== null) {
    const observations = list(get(run, "pipeline", "fanout", "observations"))
    const expectedEvents = number(get(run, "scenario", "tasks"))
    if (
      get(run, "pipeline", "fanout", "clients") !== clients ||
      observations.length !== clients ||
      new Set(observations.map((row) => row.client)).size !== clients ||
      observations.some((row, index) => row.client !== index + 1 || row.raw_events !== (expectedEvents ?? 0) * 4)
    )
      problems.push("Complete raw-event delivery to every fan-out client is not proven")
  }
  for (const [option, result] of [
    ["requests", "requests"],
    ["concurrentRequests", "concurrentRequests"],
    ["browser", "browser"],
    ["liveBrowser", "liveBrowser"],
    ["restart", "restart"],
    ["maintenance", "maintenance"],
    ["artifacts", "artifacts"],
    ["queries", "queries"],
  ])
    if (get(run, "scenario", option) && get(run, result, "status") !== "passed") problems.push(`${result} did not pass`)
  if (get(run, "scenario", "requests") && get(run, "requests", "generatorHealthy") !== true)
    problems.push("Request generator health is not proven")
  if (
    get(run, "scenario", "concurrentRequests") &&
    (get(run, "concurrentRequests", "generatorHealthy") !== true ||
      get(run, "concurrentRequests", "observedWriteProgress") !== true)
  )
    problems.push("Concurrent request generator health or overlapping write progress is not proven")
  if (number(get(run, "scenario", "history", "tasks")) && get(run, "history", "status") !== "passed")
    problems.push("History setup did not pass")
  return problems
}

export function extractMetrics(run: unknown) {
  const metrics: Record<string, Metric> = {}
  const add = (
    name: string,
    value: unknown,
    unit: Unit,
    samples: unknown = 1,
    direction: Metric["direction"] = "lower",
  ) => {
    if (name in metrics) throw new Error(`Duplicate metric ${name}`)
    metrics[name] = { value: number(value), unit, samples: number(samples), direction }
  }
  add("image.unpacked", get(run, "image", "unpackedBytes"), "bytes")
  add("pipeline.drain", get(run, "pipeline", "drain_seconds"), "s")
  add("producerObserver.cpu", get(run, "pipeline", "generator_resources", "cpu_seconds"), "cpu-s")
  add("producerObserver.peakRss", get(run, "pipeline", "generator_resources", "process_peak_rss_bytes"), "bytes")
  for (const client of list(get(run, "pipeline", "fanout", "observations"))) {
    if (typeof client.client !== "number" || client.client < 2) continue
    const latency = get(client, "publication_to_raw_event_live_ms")
    add(`live.client${client.client}.p95`, get(latency, "p95"), "ms", get(latency, "samples"))
  }
  for (const row of list(get(run, "maintenance", "cases"))) add(`maintenance.${String(row.name)}`, row.durationMs, "ms")
  if (get(run, "scenario", "restart"))
    add("restart.validatedData", get(run, "restart", "restartToValidatedDataMs"), "ms")
  if (get(run, "scenario", "liveBrowser"))
    for (const key of [
      "producerLaunchToFirstRowsMs",
      "searchToObservedRowsMs",
      "navigationToObservedResultMs",
      "producerLaunchToFinalRowsMs",
      "navigationToFinalResultMs",
    ])
      add(`liveBrowser.${key}`, get(run, "liveBrowser", key), "ms")
  for (const key of ["publication_to_raw_event_ms", "terminal_to_result_ms"]) {
    const latency = get(run, "pipeline", "public_refresh", key)
    for (const percentile of ["p50", "p95", "p99"])
      add(`pipeline.public_refresh.${key}.${percentile}`, get(latency, percentile), "ms", get(latency, "samples"))
  }
  for (const key of ["publication_to_raw_event_live_ms", "terminal_to_result_live_ms", "viewer_query_ms"])
    for (const percentile of ["p50", "p95", "p99"])
      add(
        `pipeline.${key}.${percentile}`,
        ["typed-refresh-v1", "typed-refresh-v2"].includes(String(get(run, "pipeline", "measurement_contract"))) &&
          key !== "viewer_query_ms" &&
          get(run, "pipeline", "private_live", "complete") !== true
          ? null
          : get(run, "pipeline", key, percentile),
        "ms",
        get(run, "pipeline", key, "samples"),
      )
  if (get(run, "scenario", "browser")) {
    for (const key of [
      "explorerUsefulDataMs",
      "searchNoMatchMs",
      "searchPasteNoMatchMs",
      "searchResetMs",
      "taskNavigationUsefulDataMs",
    ])
      add(`browser.${key}`, get(run, "browser", key), "ms")
    for (const key of ["assetTransferBytes", "assetEncodedBodyBytes", "assetDecodedBodyBytes"])
      add(`browser.${key}`, get(run, "browser", "journey", key), "bytes")
    for (const key of ["ttfbMs", "fcpMs", "lcpAtUsefulRowsMs"])
      add(`browser.initialDocument.${key}`, get(run, "browser", "initialDocument", key), "ms")
    add("browser.initialDocument.clsAtUsefulRows", get(run, "browser", "initialDocument", "clsAtUsefulRows"), "score")
    add("browser.journey.cls", get(run, "browser", "journey", "cls"), "score")
    add(
      "browser.lab.maximumRecordedInteractionDurationMs",
      get(run, "browser", "journey", "maximumRecordedInteractionDurationMs"),
      "ms",
      get(run, "browser", "journey", "recordedInteractionCount"),
    )
    add("browser.lab.longTaskDurationMs", get(run, "browser", "journey", "longTaskDurationMs"), "ms")
  }
  for (const row of list(get(run, "queries", "cases")))
    add(
      `query.${String(row.name)}.median`,
      row.medianMs,
      "ms",
      Array.isArray(row.samplesMs) ? row.samplesMs.length : null,
    )
  for (const section of ["requests", "concurrentRequests"])
    if (get(run, "scenario", section)) {
      add(
        `${section}.completedGoodput`,
        get(run, section, "completedGoodputPerSecond"),
        "requests/s",
        get(run, section, "successfulRequests"),
        "higher",
      )
      for (const row of list(get(run, section, "cases")))
        for (const kind of ["successfulResponseMs", "allAttemptsScheduledToCompleteMs"])
          for (const percentile of ["p50", "p95", "p99"])
            add(
              `${section}.${String(row.name)}.${kind}.${percentile}`,
              get(row, kind, percentile),
              "ms",
              get(row, kind, "samples"),
            )
    }
  for (const phase of list(get(run, "resourcePhases"))) {
    add(`resource.${String(phase.name)}.cpu`, get(phase, "summary", "cpuSeconds"), "cpu-s")
    add(
      `resource.${String(phase.name)}.cumulativeMemoryPeak`,
      get(phase, "summary", "memoryCumulativePeakBytes"),
      "bytes",
    )
  }
  if (number(get(run, "scenario", "history", "tasks")))
    for (const point of ["storageBeforeSeed", "storageAfterSeed", "storageAfterWorkload", "storageAfterStop"])
      for (const key of ["allocatedBytes", "logicalFileBytes"]) add(`${point}.${key}`, get(run, point, key), "bytes")
  if (get(run, "scenario", "artifacts"))
    for (const type of ["js", "css", "wasm"])
      for (const key of ["rawBytes", "gzipBytes", "brotliBytes"])
        add(`artifact.${type}.${key}`, get(run, "artifacts", "totals", type, key), "bytes")
  return metrics
}

export function compareRuns(baseline: unknown, candidate: unknown, budgets: Budgets = provisionalBudgets) {
  if (
    !object(budgets) ||
    !object(budgets.absolute) ||
    !Number.isFinite(budgets.relative) ||
    budgets.relative < 0 ||
    ["ms", "s", "bytes", "cpu-s", "requests/s", "score"].some((unit) => number(budgets.absolute[unit as Unit]) === null)
  )
    throw new Error("Invalid comparison budgets")
  if (
    budgets.metrics !== undefined &&
    (!object(budgets.metrics) ||
      Object.values(budgets.metrics).some(
        (policy) =>
          !object(policy) ||
          [policy.relative, policy.absolute, policy.noiseFloor].some((value) => number(value) === null),
      ))
  )
    throw new Error("Invalid per-metric comparison budgets")
  if (
    budgets.calibration &&
    (!/^[0-9a-f]{64}$/.test(budgets.calibration.seriesKey) ||
      !Number.isInteger(budgets.calibration.trials) ||
      budgets.calibration.trials < 5 ||
      !Array.isArray(budgets.calibration.runIds) ||
      budgets.calibration.runIds.length !== budgets.calibration.trials ||
      new Set(budgets.calibration.runIds).size !== budgets.calibration.trials ||
      budgets.calibration.runIds.some((id) => typeof id !== "string" || !id))
  )
    throw new Error("Invalid calibration provenance")
  const attribution = (run: unknown) => ({
    runId: get(run, "runId"),
    sourceSha: get(run, "sourceSha"),
    imageId: get(run, "image", "id"),
    sourceDirty: get(run, "sourceStatus") !== "",
    status: get(run, "status"),
  })
  const baseProblems = outcomeProblems(baseline)
  const candidateProblems = outcomeProblems(candidate)
  const a = contract(baseline),
    b = contract(candidate)
  const differences: { field: string; reason: string; baseline: unknown; candidate: unknown }[] = []
  for (const field of Object.keys(a)) {
    if (a[field] === undefined || b[field] === undefined)
      differences.push({
        field,
        reason: "required metadata missing",
        baseline: a[field] ?? null,
        candidate: b[field] ?? null,
      })
    else if (canonical(a[field]) !== canonical(b[field]))
      differences.push({ field, reason: "different comparison series", baseline: a[field], candidate: b[field] })
  }
  if (get(baseline, "schemaVersion") !== 3 || get(candidate, "schemaVersion") !== 3)
    differences.push({
      field: "schemaVersion",
      reason: "only schema 3 has the required comparison contract",
      baseline: get(baseline, "schemaVersion"),
      candidate: get(candidate, "schemaVersion"),
    })
  if (get(baseline, "executionContractVersion") !== 1 || get(candidate, "executionContractVersion") !== 1)
    differences.push({
      field: "executionContractVersion",
      reason: "Only execution contract 1 proves finalized cleanup",
      baseline: get(baseline, "executionContractVersion"),
      candidate: get(candidate, "executionContractVersion"),
    })
  if (
    budgets.calibration &&
    (comparisonSeriesKey(baseline) !== budgets.calibration.seriesKey ||
      comparisonSeriesKey(candidate) !== budgets.calibration.seriesKey)
  )
    differences.push({
      field: "budgets.calibration.seriesKey",
      reason: "noise calibration belongs to another comparison series",
      baseline: comparisonSeriesKey(baseline),
      candidate: comparisonSeriesKey(candidate),
    })
  const usable = !baseProblems.length && !candidateProblems.length && !differences.length
  const sameImage =
    typeof get(baseline, "image", "id") === "string" && get(baseline, "image", "id") === get(candidate, "image", "id")
  const candidateOutcome = get(candidate, "status")
  const invalidCandidateStatus =
    candidateOutcome === "incomplete"
      ? "candidate-incomplete"
      : candidateOutcome === "inconclusive"
        ? "candidate-inconclusive"
        : "candidate-failed"
  const left = extractMetrics(baseline),
    right = extractMetrics(candidate)
  const rows = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort().map((name) => {
    const metric = left[name] ?? right[name]
    const oldValue = left[name]?.value ?? null,
      newValue = right[name]?.value ?? null
    const delta = usable && oldValue !== null && newValue !== null ? newValue - oldValue : null
    const policy = budgets.metrics?.[name]
    const threshold =
      oldValue === null
        ? null
        : Math.max(
            oldValue * (policy?.relative ?? budgets.relative),
            policy?.absolute ?? budgets.absolute[metric.unit],
            policy?.noiseFloor ?? 0,
          )
    const worsening = delta === null ? null : metric.direction === "lower" ? delta : -delta
    return {
      name,
      unit: metric.unit,
      direction: metric.direction,
      baseline: oldValue,
      candidate: newValue,
      baselineSamples: left[name]?.samples ?? null,
      candidateSamples: right[name]?.samples ?? null,
      delta,
      relativeDelta: delta !== null && oldValue !== 0 ? delta / oldValue! : null,
      threshold,
      status: !usable
        ? "not-compared"
        : delta === null
          ? "unavailable"
          : worsening! > threshold!
            ? "flagged"
            : "within-provisional-budget",
    }
  })
  return {
    comparisonSchemaVersion: 1,
    purpose: sameImage ? "same-image-calibration" : "candidate-comparison",
    status: baseProblems.length
      ? "unusable-baseline"
      : candidateProblems.length
        ? invalidCandidateStatus
        : differences.length
          ? "incompatible"
          : "report-only",
    baseline: attribution(baseline),
    candidate: attribution(candidate),
    baselineProblems: baseProblems,
    candidateProblems,
    incompatibilities: differences,
    budgets,
    flaggedCount: rows.filter((row) => row.status === "flagged").length,
    rows,
    limitations: [
      budgets.calibration
        ? "Timing flags use supplied empirical noise floors from the recorded compatible series; no automatic timing gate is enabled."
        : "Timing flags use supplied budgets with unverified calibration provenance; no automatic timing gate is enabled.",
      "A single-run comparison cannot establish reproducibility; confirm suspects with controlled baseline/candidate repetitions.",
      "Application image, source, query implementation and dependency changes are attribution, not compatibility exclusions.",
      "Hosted runner class/hardware metadata does not prove uncontended or equivalent storage; tight gates and sizing require controlled confirmation.",
    ],
  }
}

export function comparisonMarkdown(report: ReturnType<typeof compareRuns>) {
  const cell = (value: unknown) =>
    String(value ?? "unavailable")
      .replaceAll("|", "\\|")
      .replaceAll("\n", " ")
  const display = (value: number | null) => (value === null ? "unavailable" : String(Number(value.toPrecision(6))))
  return [
    "# Benchmark comparison",
    "",
    `Status: **${report.status}**. ${report.flaggedCount} provisional flags.`,
    `Purpose: **${report.purpose}**.`,
    "",
    `Baseline: ${cell(report.baseline.runId)} (${cell(report.baseline.sourceSha)}, dirty workspace: ${report.baseline.sourceDirty}). Image: ${cell(report.baseline.imageId)}.`,
    `Candidate: ${cell(report.candidate.runId)} (${cell(report.candidate.sourceSha)}, dirty workspace: ${report.candidate.sourceDirty}). Image: ${cell(report.candidate.imageId)}.`,
    "",
    ...[
      ...report.baselineProblems.map((reason) => `Baseline: ${reason}`),
      ...report.candidateProblems.map((reason) => `Candidate: ${reason}`),
      ...report.incompatibilities.map((entry) => `${entry.field}: ${entry.reason}`),
    ].map((reason) => `- ${cell(reason)}`),
    "",
    "| Metric | Unit | Better | Baseline | Candidate | Delta | Delta % | Threshold | Samples (base/new) | Status |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |",
    ...report.rows.map(
      (row) =>
        `| ${cell(row.name)} | ${row.unit} | ${row.direction} | ${display(row.baseline)} | ${display(row.candidate)} | ${display(row.delta)} | ${display(row.relativeDelta === null ? null : row.relativeDelta * 100)} | ${display(row.threshold)} | ${cell(row.baselineSamples)}/${cell(row.candidateSamples)} | ${row.status} |`,
    ),
    "",
    ...report.limitations.map((limitation) => `- ${limitation}`),
    "",
  ].join("\n")
}
