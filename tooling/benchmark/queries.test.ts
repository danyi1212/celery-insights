// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest"
import { benchmarkQueries } from "./queries"

const calls = vi.hoisted(() => ({ connect: vi.fn(), collect: vi.fn(), close: vi.fn() }))
vi.mock("surrealdb", async (original) => ({
  ...(await original<typeof import("surrealdb")>()),
  Surreal: class {
    connect = calls.connect
    async signin() {}
    async use() {}
    query(sql: string, bindings: unknown) {
      return { collect: () => calls.collect(sql, bindings) }
    }
    close = calls.close
  },
}))

beforeEach(() => {
  vi.resetAllMocks()
})

test("a query failure retains completed samples and identifies the failed operation", async () => {
  let explorerRequests = 0
  calls.collect.mockImplementation(
    async (_sql: string, bindings: { request: { operation: string; query?: string } }) => {
      if (bindings.request.operation === "list") return [[]]
      if (bindings.request.query === "history-") return [[], [{ count: 0 }], []]
      explorerRequests++
      // One validated warmup, one successful trial, then a failed trial.
      if (explorerRequests === 3) throw new Error("native query disconnected")
      return [[], [{ count: 0 }], [], [], [], []]
    },
  )
  const result = await benchmarkQueries("http://localhost:1", 0, 0, "2026-10-10T10:00:00Z", 3)
  expect(result).toMatchObject({
    status: "failed",
    error: "Error: native query disconnected",
    failedOperation: { stage: "query-trial-1", caseName: "tasks.all" },
    cases: [{ name: "tasks.all", status: "failed" }],
  })
  expect(result.cases).toHaveLength(1)
  expect(result.cases[0].samplesMs).toHaveLength(1)
  expect(calls.close).toHaveBeenCalledOnce()
})

test("connection failure is retained without fabricated query samples", async () => {
  calls.connect.mockRejectedValue(new Error("database unavailable"))
  const result = await benchmarkQueries("http://localhost:1", 0, 0, "2026-10-10T10:00:00Z", 3)
  expect(result).toMatchObject({
    status: "failed",
    failedOperation: { stage: "connect", caseName: null },
    cases: [],
  })
  expect(calls.collect).not.toHaveBeenCalled()
  expect(calls.close).toHaveBeenCalledOnce()
})
