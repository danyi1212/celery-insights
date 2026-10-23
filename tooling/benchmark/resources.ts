/** One bounded external snapshot; requires only the image's existing Python runtime. */
export const resourceSnapshotScript = `
import json, os, time
from pathlib import Path
def read(name):
    try:
        return Path(name).read_text().strip()
    except (OSError, UnicodeError):
        return None
def fields(name):
    content = read(name)
    return {line.split()[0]: int(line.split()[1]) for line in content.splitlines()} if content is not None else None
base = '/sys/fs/cgroup/'
processes = []
for directory in Path('/proc').iterdir():
    if not directory.name.isdigit() or int(directory.name) == os.getpid():
        continue
    raw = read(str(directory / 'stat'))
    if raw is None:
        continue
    values = raw.rsplit(')',1)[1].split()
    processes.append({'pid':int(directory.name), 'name':raw.split('(',1)[1].rsplit(')',1)[0],
        'userTicks':int(values[11]), 'systemTicks':int(values[12]), 'startTicks':int(values[19]),
        'rssBytes':int(values[21])*os.sysconf('SC_PAGE_SIZE')})
print(json.dumps({'monotonicSeconds':time.monotonic(), 'clockTicksPerSecond':os.sysconf('SC_CLK_TCK'),
    'cpuStat':fields(base+'cpu.stat'), 'cpuMax':read(base+'cpu.max'),
    'memoryCurrentBytes':read(base+'memory.current'), 'memoryPeakBytes':read(base+'memory.peak'),
    'memoryStat':fields(base+'memory.stat'), 'memoryEvents':fields(base+'memory.events'),
    'ioStat':read(base+'io.stat'), 'processes':processes}))
`

export interface ResourceSnapshot {
  monotonicSeconds: number
  clockTicksPerSecond: number
  cpuStat: Record<string, number> | null
  cpuMax: string | null
  memoryCurrentBytes: string | null
  memoryPeakBytes: string | null
  memoryStat: Record<string, number> | null
  memoryEvents: Record<string, number> | null
  ioStat: string | null
  processes: {
    pid: number
    name: string
    userTicks: number
    systemTicks: number
    startTicks: number
    rssBytes: number
  }[]
}

export function resourceDelta(before: ResourceSnapshot, after: ResourceSnapshot) {
  const elapsedSeconds = after.monotonicSeconds - before.monotonicSeconds
  const counter = (key: string) =>
    typeof before.cpuStat?.[key] === "number" && typeof after.cpuStat?.[key] === "number"
      ? after.cpuStat[key] - before.cpuStat[key]
      : null
  const cpuUsec = counter("usage_usec")
  return {
    elapsedSeconds,
    cpuSeconds: cpuUsec === null ? null : cpuUsec / 1e6,
    averageCpuCores: cpuUsec === null || elapsedSeconds <= 0 ? null : cpuUsec / 1e6 / elapsedSeconds,
    throttledPeriods: counter("nr_throttled"),
    periods: counter("nr_periods"),
    throttledSeconds: counter("throttled_usec") === null ? null : counter("throttled_usec")! / 1e6,
    cpuMax: after.cpuMax,
    memoryCurrentBytes: after.memoryCurrentBytes === null ? null : Number(after.memoryCurrentBytes),
    memoryCumulativePeakBytes: after.memoryPeakBytes === null ? null : Number(after.memoryPeakBytes),
    inactiveFileBytes: after.memoryStat?.inactive_file ?? null,
    processes: after.processes.map((process) => {
      const initial = before.processes.find(
        (candidate) => candidate.pid === process.pid && candidate.startTicks === process.startTicks,
      )
      return {
        pid: process.pid,
        name: process.name,
        rssBytes: process.rssBytes,
        cpuSeconds: initial
          ? (process.userTicks + process.systemTicks - initial.userTicks - initial.systemTicks) /
            after.clockTicksPerSecond
          : null,
      }
    }),
    limitations: [
      "cgroup v2 counters are unavailable on unsupported hosts; memory peak is cumulative since container start.",
      "Snapshots bracket the phase and include collector/container-exec overhead; CPU is not a pure request-service cost.",
      "Per-process RSS is not additive container working set; exited/replaced process CPU is not attributed.",
    ],
  }
}

export function resourceTrend(samples: ResourceSnapshot[], warmupSeconds = 30) {
  const ordered = [...samples].sort((a, b) => a.monotonicSeconds - b.monotonicSeconds)
  const steady = ordered.filter(
    (sample) => sample.monotonicSeconds >= (ordered[0]?.monotonicSeconds ?? 0) + warmupSeconds,
  )
  const durationSeconds = steady.length > 1 ? steady.at(-1)!.monotonicSeconds - steady[0].monotonicSeconds : 0
  const slope = (values: (number | null)[]) => {
    if (steady.length < 3 || durationSeconds < 30 || values.some((value) => value === null)) return null
    const xs = steady.map((sample) => sample.monotonicSeconds - steady[0].monotonicSeconds)
    const ys = values as number[]
    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length
    const numerator = xs.reduce((sum, x, index) => sum + (x - meanX) * (ys[index] - meanY), 0)
    const denominator = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0)
    return denominator > 0 ? numerator / denominator : null
  }
  const numeric = (value: unknown) => {
    if (value === null || value === undefined) return null
    const number = Number(value)
    return Number.isFinite(number) && number >= 0 ? number : null
  }
  const memory = steady.map((sample) => numeric(sample.memoryCurrentBytes))
  const anon = steady.map((sample) => numeric(sample.memoryStat?.anon))
  return {
    status: steady.length >= 3 && durationSeconds >= 30 ? "observed" : "insufficient-samples",
    totalSamples: samples.length,
    steadySamples: steady.length,
    warmupSeconds,
    durationSeconds,
    sampledPeakMemoryBytes: memory.some((value) => value !== null)
      ? Math.max(...memory.filter((value) => value !== null))
      : null,
    memoryBytesPerSecond: slope(memory),
    anonymousBytesPerSecond: slope(anon),
    steadyResources: durationSeconds > 0 ? resourceDelta(steady[0], steady.at(-1)!) : null,
    limitations: [
      "Least-squares slopes exclude the declared initial warmup; sampled peaks can miss bursts.",
      "Retained data grows during ingestion; positive memory slope is not evidence of a leak or a sustainable limit.",
      "Sampling includes collector overhead; unsupported counters remain unavailable.",
    ],
  }
}
