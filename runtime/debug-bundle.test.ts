import { describe, expect, it, vi } from "vitest"
import { parseConfig } from "./config"
import { exportSurrealData, importSurrealData, redactConfig } from "./debug-bundle"

describe("debug-bundle surreal helpers", () => {
  it("exports data when query resolves to raw arrays", async () => {
    const db = {
      query: vi
        .fn()
        .mockResolvedValueOnce([[{ id: "task:1" }]])
        .mockResolvedValueOnce([[{ id: "event:1" }]])
        .mockResolvedValueOnce([[{ id: "worker:1" }]]),
    }

    const result = await exportSurrealData(db as never)

    expect(result).toEqual({
      version: 1,
      tasks: [{ id: "task:1" }],
      events: [{ id: "event:1" }],
      workers: [{ id: "worker:1" }],
    })
  })

  it("exports data when query returns collectable results", async () => {
    const db = {
      query: vi
        .fn()
        .mockReturnValueOnce({ collect: vi.fn().mockResolvedValue([[{ id: "task:1" }]]) })
        .mockReturnValueOnce({ collect: vi.fn().mockResolvedValue([[{ id: "event:1" }]]) })
        .mockReturnValueOnce({ collect: vi.fn().mockResolvedValue([[{ id: "worker:1" }]]) }),
    }

    const result = await exportSurrealData(db as never)

    expect(result.tasks).toEqual([{ id: "task:1" }])
    expect(result.events).toEqual([{ id: "event:1" }])
    expect(result.workers).toEqual([{ id: "worker:1" }])
  })

  it("imports data when query resolves directly", async () => {
    const db = {
      query: vi.fn().mockResolvedValue([]),
    }

    await importSurrealData(db as never, {
      version: 1,
      tasks: [{ id: "task:1", state: "SUCCESS" }],
      events: [],
      workers: [],
    })

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("UPSERT type::record('task', $record.id)"), {
      tasks_0: [{ id: 1, data: { state: "SUCCESS" } }],
    })
  })

  it("imports data when query returns a collectable result", async () => {
    const collect = vi.fn().mockResolvedValue([])
    const db = {
      query: vi.fn().mockReturnValue({ collect }),
    }

    await importSurrealData(db as never, {
      version: 1,
      tasks: [],
      events: [{ id: "event:1", event_type: "task-succeeded" }],
      workers: [],
    })

    expect(collect).toHaveBeenCalled()
  })

  it("normalizes surreal record ids before import", async () => {
    const db = {
      query: vi.fn().mockResolvedValue([]),
    }

    await importSurrealData(db as never, {
      version: 1,
      tasks: [{ id: "task:⟨abc-123⟩", state: "SUCCESS" }],
      events: [],
      workers: [{ id: "worker:⟨worker@example⟩", active: 1 }],
    })

    expect(db.query).toHaveBeenCalledWith(expect.any(String), {
      tasks_0: [{ id: "abc-123", data: { state: "SUCCESS" } }],
      workers_0: [{ id: "worker@example", data: { active: 1 } }],
    })
  })

  it("revives known datetime fields before import", async () => {
    const db = {
      query: vi.fn().mockResolvedValue([]),
    }

    await importSurrealData(db as never, {
      version: 1,
      tasks: [
        {
          id: "task:1",
          state: "SUCCESS",
          failed_at: "2026-03-14T18:43:05.917351Z",
          first_observed_at: "2026-03-14T18:40:00.000000Z",
          execution_observed_at: "2026-03-14T18:42:00.000000Z",
          execution_active_at: "2026-03-14T18:41:00.000000Z",
        },
      ],
      events: [{ id: "event:1", timestamp: "2026-03-14T18:43:05.917351Z" }],
      workers: [{ id: "worker:1", last_updated: "2026-03-14T18:43:05.917351Z" }],
    })

    expect(db.query).toHaveBeenCalledWith(expect.any(String), {
      tasks_0: [
        {
          id: 1,
          data: {
            state: "SUCCESS",
            failed_at: new Date("2026-03-14T18:43:05.917351Z"),
            first_observed_at: new Date("2026-03-14T18:40:00.000000Z"),
            execution_observed_at: new Date("2026-03-14T18:42:00.000000Z"),
            execution_active_at: new Date("2026-03-14T18:41:00.000000Z"),
          },
        },
      ],
      events_0: [{ id: 1, data: { timestamp: new Date("2026-03-14T18:43:05.917351Z") } }],
      workers_0: [{ id: 1, data: { last_updated: new Date("2026-03-14T18:43:05.917351Z") } }],
    })
  })
})

it("redacts the MCP token in diagnostic bundles", () => {
  expect(redactConfig(parseConfig({ MCP_TOKEN: "private-token" }), false).mcpCursorSecret).toBe("***REDACTED***")
})

it("restores escaped record identifiers without changing their value", async () => {
  const { RecordId } = await import("surrealdb")
  const query = vi.fn().mockResolvedValue([])
  const id = new RecordId("worker", "host:abc⟩\\node")
  await importSurrealData(
    { query } as never,
    JSON.parse(JSON.stringify({ version: 1, tasks: [], events: [], workers: [{ id }] })),
  )
  expect(query.mock.calls[0][1].workers_0[0].id).toBe("host:abc⟩\\node")
})
