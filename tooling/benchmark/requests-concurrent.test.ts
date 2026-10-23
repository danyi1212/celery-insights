// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest"
import { benchmarkConcurrentRequests } from "./requests"

afterEach(() => vi.unstubAllGlobals())

test("unchanged counts cannot establish API/write overlap even with successful responses", async () => {
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (url.endsWith("/api/config")) return Response.json({ observationPath: "/api/observation/rpc" })
    if (url.endsWith("/api/settings/info")) return Response.json({ task_count: 4, event_count: 16 })
    const request = JSON.parse(String(init.body))
    return Response.json({
      id: request.id,
      result: {
        structuredContent: {
          task: { task_id: "history-1", state: "SUCCESS", workflow_id: "history-0" },
          output: { result: { availability: "available", text: "history-result-1" } },
        },
      },
    })
  })
  const produce = vi.fn(async () => ({ oracle: "independent" }))
  const result = await benchmarkConcurrentRequests("http://fixture", 4, 32, 12, 100, 32, produce)
  expect(result.requests).toMatchObject({
    status: "inconclusive",
    observedWriteProgress: false,
    successfulRequests: 12,
  })
  expect(result.production).toEqual({ oracle: "independent" })
  expect(produce).toHaveBeenCalledOnce()
})

test("API warmup failure still runs and retains the independent producer", async () => {
  vi.stubGlobal("fetch", async () => {
    throw new Error("Unavailable API")
  })
  const produce = vi.fn(async () => ({ status: "passed", validated_events: 128 }))
  const result = await benchmarkConcurrentRequests("http://fixture", 4, 32, 12, 100, 32, produce)
  expect(result.requests).toMatchObject({ status: "failed", stage: "warmup" })
  expect(result.production).toEqual({ status: "passed", validated_events: 128 })
  expect(produce).toHaveBeenCalledOnce()
})
