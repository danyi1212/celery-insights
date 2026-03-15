import { renderHook, waitFor } from "@testing-library/react"
import { useLiveEvents, useTaskEvents } from "./use-live-events"

vi.mock("surrealdb", () => ({}))

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

function createMockSubscription() {
  const subscription = {
    id: MOCK_LIVE_UUID,
    isManaged: false,
    isAlive: true,
    resource: "event",
    kill: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(() => () => {}),
    [Symbol.asyncIterator]: vi.fn(),
  }
  return { subscription }
}

/** Set mockQuery to return the given result for initial queries and a UUID for LIVE SELECT */
function setInitialQueryResult(result: unknown) {
  mockQuery.mockImplementation((query: string) => {
    if (typeof query === "string" && query.startsWith("LIVE SELECT")) {
      return Promise.resolve([MOCK_LIVE_UUID])
    }
    return Promise.resolve(result)
  })
}

describe("useLiveEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStatus = "connected"
    setInitialQueryResult([[]])
    const { subscription } = createMockSubscription()
    mockLiveOf.mockResolvedValue(subscription)
  })

  it("queries events with ORDER BY timestamp DESC and LIMIT", async () => {
    renderHook(() => useLiveEvents(50))

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM event ORDER BY timestamp DESC LIMIT $limit", {
        limit: 50,
      })
    })
  })

  it("uses default limit of 100", async () => {
    renderHook(() => useLiveEvents())

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM event ORDER BY timestamp DESC LIMIT $limit", {
        limit: 100,
      })
    })
  })

  it("subscribes to the event table via LIVE SELECT", async () => {
    renderHook(() => useLiveEvents())

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledWith("LIVE SELECT * FROM event")
      expect(mockLiveOf).toHaveBeenCalledWith(MOCK_LIVE_UUID)
    })
  })
})

describe("useTaskEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStatus = "connected"
    setInitialQueryResult([[]])
    const { subscription } = createMockSubscription()
    mockLiveOf.mockResolvedValue(subscription)
  })

  it("queries events for a specific task ordered by timestamp ASC", async () => {
    renderHook(() => useTaskEvents("task-abc"))

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM event WHERE task_id = $taskId ORDER BY timestamp", {
        taskId: "task-abc",
      })
    })
  })

  it("does not run when taskId is empty", async () => {
    renderHook(() => useTaskEvents(""))

    await waitFor(() => {
      expect(mockQuery).not.toHaveBeenCalled()
    })
  })
})
