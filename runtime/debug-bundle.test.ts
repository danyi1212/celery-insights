import { describe, expect, it, vi } from "vitest"
import { exportSurrealData, extractSurrealTableData, importSurrealData } from "./debug-bundle"

describe("debug-bundle surreal helpers", () => {
  it("extracts only table data statements from a native surreal export", () => {
    const sql = `-- ------------------------------
-- OPTION
-- ------------------------------

OPTION IMPORT;

-- ------------------------------
-- USERS
-- ------------------------------

DEFINE USER viewer ON DATABASE PASSWORD 'viewer';

-- ------------------------------
-- TABLE: event
-- ------------------------------

DEFINE TABLE event TYPE ANY SCHEMALESS;

-- ------------------------------
-- TABLE DATA: event
-- ------------------------------

INSERT [{ id: event:1, timestamp: d'2026-03-14T21:30:33.586144Z' }];

-- ------------------------------
-- TABLE: task
-- ------------------------------

DEFINE TABLE task TYPE NORMAL SCHEMAFULL;

-- ------------------------------
-- TABLE DATA: task
-- ------------------------------

INSERT [{ id: task:1, last_updated: d'2026-03-14T21:30:33.586144Z' }];
`

    expect(extractSurrealTableData(sql, ["event", "task", "worker"])).toBe(`OPTION IMPORT;

INSERT [{ id: event:1, timestamp: d'2026-03-14T21:30:33.586144Z' }];

INSERT [{ id: task:1, last_updated: d'2026-03-14T21:30:33.586144Z' }];
`)
  })

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
      tasks_0: [{ id: "1", data: { state: "SUCCESS" } }],
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
      tasks: [{ id: "task:1", state: "SUCCESS", failed_at: "2026-03-14T18:43:05.917351Z" }],
      events: [{ id: "event:1", timestamp: "2026-03-14T18:43:05.917351Z" }],
      workers: [{ id: "worker:1", last_updated: "2026-03-14T18:43:05.917351Z" }],
    })

    expect(db.query).toHaveBeenCalledWith(expect.any(String), {
      tasks_0: [{ id: "1", data: { state: "SUCCESS", failed_at: new Date("2026-03-14T18:43:05.917351Z") } }],
      events_0: [{ id: "1", data: { timestamp: new Date("2026-03-14T18:43:05.917351Z") } }],
      workers_0: [{ id: "1", data: { last_updated: new Date("2026-03-14T18:43:05.917351Z") } }],
    })
  })
})
