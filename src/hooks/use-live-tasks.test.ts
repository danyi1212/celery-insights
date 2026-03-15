import { renderHook, waitFor } from "@testing-library/react"
import { useLiveTasks, useWorkerTasks, useWorkflowTasks, useTask } from "./use-live-tasks"

vi.mock("surrealdb", () => ({
  RecordId: class RecordId {
    constructor(
      public tb: string,
      public id: string,
    ) {}
  },
}))

const mockQuery = vi.fn()
const mockLiveOf = vi.fn()
const MOCK_LIVE_UUID = "mock-live-uuid"
const mockDb = { query: mockQuery, liveOf: mockLiveOf }
let mockStatus = "connected"

vi.mock("@components/surrealdb-provider", () => ({
  useSurrealDB: () => ({
    db: mockDb,
    status: mockStatus,
    ingestionStatus: "leader",
    error: null,
  }),
}))

/** Set mockQuery to return the given result for initial queries and a UUID for LIVE SELECT */
function setInitialQueryResult(result: unknown) {
  mockQuery.mockImplementation((query: string) => {
    if (typeof query === "string" && query.startsWith("LIVE SELECT")) {
      return Promise.resolve([MOCK_LIVE_UUID])
    }
    return Promise.resolve(result)
  })
}

function createMockSubscription() {
  const subscription = {
    id: MOCK_LIVE_UUID,
    isManaged: false,
    isAlive: true,
    resource: "task",
    kill: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(() => () => {}),
    [Symbol.asyncIterator]: vi.fn(),
  }
  return { subscription }
}

describe("useLiveTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStatus = "connected"
    setInitialQueryResult([[]])
    const { subscription } = createMockSubscription()
    mockLiveOf.mockResolvedValue(subscription)
  })

  it("queries with ORDER BY last_updated DESC and LIMIT", async () => {
    renderHook(() => useLiveTasks(10))

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM task ORDER BY last_updated DESC LIMIT $limit", {
        limit: 10,
      })
    })
  })

  it("uses default limit of 30", async () => {
    renderHook(() => useLiveTasks())

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM task ORDER BY last_updated DESC LIMIT $limit", {
        limit: 30,
      })
    })
  })

  it("subscribes to the task table via LIVE SELECT", async () => {
    renderHook(() => useLiveTasks())

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledWith("LIVE SELECT * FROM task")
      expect(mockLiveOf).toHaveBeenCalledWith(MOCK_LIVE_UUID)
    })
  })
})

describe("useWorkerTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStatus = "connected"
    setInitialQueryResult([[]])
    const { subscription } = createMockSubscription()
    mockLiveOf.mockResolvedValue(subscription)
  })

  it("queries tasks filtered by worker ID", async () => {
    renderHook(() => useWorkerTasks("worker-1"))

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM task WHERE worker = $workerId ORDER BY last_updated DESC", {
        workerId: "worker-1",
      })
    })
  })

  it("does not run when workerId is empty", async () => {
    renderHook(() => useWorkerTasks(""))

    await waitFor(() => {
      expect(mockQuery).not.toHaveBeenCalled()
    })
  })
})

describe("useWorkflowTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStatus = "connected"
    setInitialQueryResult([[]])
    const { subscription } = createMockSubscription()
    mockLiveOf.mockResolvedValue(subscription)
  })

  it("queries tasks by workflow_id", async () => {
    renderHook(() => useWorkflowTasks("abc-123"))

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM task WHERE workflow_id = $workflowId ORDER BY last_updated DESC",
        { workflowId: "abc-123" },
      )
    })
  })

  it("does not run when workflowId is empty", async () => {
    renderHook(() => useWorkflowTasks(""))

    await waitFor(() => {
      expect(mockQuery).not.toHaveBeenCalled()
    })
  })
})

describe("useTask", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStatus = "connected"
    setInitialQueryResult([[]])
    const { subscription } = createMockSubscription()
    mockLiveOf.mockResolvedValue(subscription)
  })

  it("queries a single task by ID using RecordId binding", async () => {
    renderHook(() => useTask("my-task-id"))

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM $rid", expect.objectContaining({}))
      const bindings = mockQuery.mock.calls[0][1]
      expect(bindings.rid).toEqual(expect.objectContaining({ tb: "task", id: "my-task-id" }))
    })
  })

  it("returns task as null when data is empty", async () => {
    const { result } = renderHook(() => useTask("my-task-id"))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.task).toBeNull()
  })

  it("returns task from data array", async () => {
    const taskRecord = {
      id: "task:my-task-id",
      state: "SUCCESS",
      last_updated: "2024-01-01T00:00:00Z",
      children: [],
    }
    setInitialQueryResult([[taskRecord]])

    const { result } = renderHook(() => useTask("my-task-id"))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.task).toEqual(taskRecord)
  })

  it("returns task when SDK returns single object (record-specific SELECT)", async () => {
    const taskRecord = {
      id: "task:my-task-id",
      state: "SUCCESS",
      last_updated: "2024-01-01T00:00:00Z",
      children: [],
    }
    // SurrealDB JS SDK v2 returns a single object (not array) for
    // SELECT * FROM $rid (record-specific SELECT) — useLiveQuery normalizes it to an array
    setInitialQueryResult([taskRecord])

    const { result } = renderHook(() => useTask("my-task-id"))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.task).toEqual(taskRecord)
  })

  it("does not run when taskId is empty", async () => {
    renderHook(() => useTask(""))

    await waitFor(() => {
      expect(mockQuery).not.toHaveBeenCalled()
    })
  })
})
