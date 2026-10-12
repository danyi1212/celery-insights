// @vitest-environment node
import { expect, test } from "vitest"
import { summarizeCeleryPairs } from "./celery"

const attempt = (monitored: boolean) => ({
  pair: 1,
  monitored,
  status: "passed",
  pipeline: {
    generator_healthy: true,
    persisted: monitored ? { passed: true } : null,
    task_completion_ms: { p50: monitored ? 15 : 10, p95: monitored ? 30 : 20 },
    completed_task_goodput_per_second: monitored ? 18 : 20,
  },
  workerResources: { cpuSeconds: monitored ? 2 : 1 },
})

test("paired monitoring comparison follows mode rather than completion order", () => {
  const result = summarizeCeleryPairs([attempt(true), attempt(false)], 1)
  expect(result.validPairs).toBe(1)
  expect(result.pairs[0].metrics.completionP95Ms).toEqual({
    baseline: 20,
    monitored: 30,
    delta: 10,
    relativeDelta: 0.5,
  })
  expect(result.pairs[0].metrics.goodputTasksPerSecond.delta).toBe(-2)
})

test("lost monitored history or an unhealthy producer cannot look like an overhead improvement", () => {
  const baseline = attempt(false),
    monitored = attempt(true)
  monitored.pipeline.task_completion_ms.p95 = 1
  monitored.pipeline.persisted = { passed: false }
  expect(summarizeCeleryPairs([baseline, monitored], 1).pairs[0].metrics.completionP95Ms.delta).toBeNull()
  monitored.pipeline.persisted = { passed: true }
  monitored.pipeline.generator_healthy = false
  expect(summarizeCeleryPairs([baseline, monitored], 1).validPairs).toBe(0)
  expect(summarizeCeleryPairs([baseline], 1).pairs[0].status).toBe("unavailable")
})
