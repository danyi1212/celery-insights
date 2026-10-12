// @vitest-environment node
import { expect, test } from "vitest"
import { readAllObservation } from "./observation"
import type { Surreal } from "surrealdb"

test("public pagination uses typed requests and retains every returned ID", async () => {
  const requests: unknown[] = []
  const pages = [Array.from({ length: 1000 }, (_, id) => ({ id: `task:${id}` })), [{ id: "task:1000" }]]
  const db = {
    query(sql: string, bindings: unknown) {
      expect(sql).toBe("observation:read")
      requests.push(bindings)
      return { collect: async () => [pages.shift()] }
    },
  }
  const rows = await readAllObservation(db as unknown as Surreal, "task", "history-")
  expect(rows).toHaveLength(1001)
  expect(requests).toEqual(
    [0, 1000].map((offset) => ({
      request: {
        operation: "list",
        table: "task",
        query: "history-",
        limit: 1000,
        offset,
      },
    })),
  )
})
