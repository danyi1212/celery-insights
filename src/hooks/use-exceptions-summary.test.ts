import { renderHook, act, waitFor } from "@testing-library/react"
import { useExceptionsSummary } from "./use-exceptions-summary"

vi.mock("surrealdb", () => ({
  Table: class {
    name: string
    constructor(name: string) {
      this.name = name
    }
  },
}))

type LiveMessage = {
  queryId: unknown
  action: "CREATE" | "UPDATE" | "DELETE" | "KILLED"
  recordId: unknown
  value: Record<string, unknown>
}

const mockQuery = vi.fn()
const mockLive = vi.fn()
const mockDb = { query: mockQuery, live: mockLive }
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
  const handlers: Array<(message: LiveMessage) => void> = []
  const subscription = {
    id: "test-uuid",
    isManaged: true,
    isAlive: true,
    resource: "task",
    kill: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn((handler: (message: LiveMessage) => void) => {
      handlers.push(handler)
      return () => {
        const idx = handlers.indexOf(handler)
        if (idx >= 0) handlers.splice(idx, 1)
      }
    }),
    [Symbol.asyncIterator]: vi.fn(),
  }
  return {
    subscription,
    emit: (message: LiveMessage) => handlers.forEach((h) => h(message)),
  }
}

describe("useExceptionsSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStatus = "connected"
    mockQuery.mockResolvedValue([[]])
    const { subscription } = createMockSubscription()
    mockLive.mockResolvedValue(subscription)
  })

  it("runs the aggregation query on mount", async () => {
    renderHook(() => useExceptionsSummary())

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT exception, count() AS count FROM task WHERE exception != NONE GROUP BY exception ORDER BY count DESC",
      )
    })
  })

  it("returns aggregated exception data", async () => {
    const summaryData = [
      { exception: "ValueError: bad input", count: 5 },
      { exception: "TimeoutError", count: 2 },
    ]
    mockQuery.mockResolvedValue([summaryData])

    const { result } = renderHook(() => useExceptionsSummary())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual(summaryData)
    expect(result.current.error).toBeNull()
  })

  it("subscribes to the task table for live updates", async () => {
    renderHook(() => useExceptionsSummary())

    await waitFor(() => {
      expect(mockLive).toHaveBeenCalledWith(expect.objectContaining({ name: "task" }))
    })
  })

  it("re-runs aggregation debounced on live CREATE", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    const mock = createMockSubscription()
    mockLive.mockResolvedValue(mock.subscription)
    mockQuery.mockResolvedValue([[]])

    renderHook(() => useExceptionsSummary())

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledTimes(1)
    })

    // Emit a CREATE event
    act(() => {
      mock.emit({
        queryId: "test-uuid",
        action: "CREATE",
        recordId: "task:1",
        value: { id: "task:1", exception: "SomeError" },
      })
    })

    // Should not re-query immediately (debounced)
    expect(mockQuery).toHaveBeenCalledTimes(1)

    // Advance past debounce timer
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledTimes(2)
    })

    vi.useRealTimers()
  })

  it("does not re-run aggregation on DELETE", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    const mock = createMockSubscription()
    mockLive.mockResolvedValue(mock.subscription)
    mockQuery.mockResolvedValue([[]])

    renderHook(() => useExceptionsSummary())

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledTimes(1)
    })

    act(() => {
      mock.emit({
        queryId: "test-uuid",
        action: "DELETE",
        recordId: "task:1",
        value: { id: "task:1" },
      })
    })

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    // Should still be 1 — DELETE does not trigger re-aggregation
    expect(mockQuery).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it("sets error when aggregation query fails", async () => {
    mockQuery.mockRejectedValue(new Error("Aggregation failed"))

    const { result } = renderHook(() => useExceptionsSummary())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toEqual(new Error("Aggregation failed"))
    expect(result.current.data).toEqual([])
  })
})
