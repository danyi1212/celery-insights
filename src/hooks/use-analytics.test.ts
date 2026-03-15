import { renderHook, act, waitFor } from "@testing-library/react"
import { useAnalytics } from "./use-analytics"

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

const emptyResults = [[], [], [], []]

describe("useAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStatus = "connected"
    mockQuery.mockResolvedValue(emptyResults)
    const { subscription } = createMockSubscription()
    mockLive.mockResolvedValue(subscription)
  })

  it("runs all four aggregation queries on mount", async () => {
    renderHook(() => useAnalytics("24h"))

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledTimes(1)
    })

    const queryString = mockQuery.mock.calls[0][0] as string
    expect(queryString).toContain("FROM task")
    expect(queryString).toContain("GROUP BY bucket")
    expect(queryString).toContain("math::mean(runtime)")
    expect(queryString).toContain("GROUP BY worker")
  })

  it("passes correct bindings for the time range", async () => {
    renderHook(() => useAnalytics("1h"))

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledTimes(1)
    })

    const bindings = mockQuery.mock.calls[0][1] as Record<string, unknown>
    expect(bindings.cutoffDuration).toBe("3600s")
    expect(bindings.bucketDuration).toBe("1m")
  })

  it("passes correct bindings for 7d time range", async () => {
    renderHook(() => useAnalytics("7d"))

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledTimes(1)
    })

    const bindings = mockQuery.mock.calls[0][1] as Record<string, unknown>
    expect(bindings.cutoffDuration).toBe("604800s")
    expect(bindings.bucketDuration).toBe("360m")
  })

  it("returns analytics data from query results", async () => {
    const throughput = [{ bucket: "2025-01-01T12:00", count: 10 }]
    const failureRate = [{ bucket: "2025-01-01T12:00", success: 8, failure: 2, total: 10, failure_rate: 20 }]
    const durationByType = [{ type: "app.tasks.add", avg_runtime: 1.5, min_runtime: 0.5, max_runtime: 3.0, count: 10 }]
    const workerLoad = [{ worker: "worker1@host", count: 15 }]

    mockQuery.mockResolvedValue([throughput, failureRate, durationByType, workerLoad])

    const { result } = renderHook(() => useAnalytics("24h"))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data.throughput).toEqual(throughput)
    expect(result.current.data.failureRate).toEqual(failureRate)
    expect(result.current.data.durationByType).toEqual(durationByType)
    expect(result.current.data.workerLoad).toEqual(workerLoad)
    expect(result.current.error).toBeNull()
  })

  it("subscribes to the task table for live updates", async () => {
    renderHook(() => useAnalytics("24h"))

    await waitFor(() => {
      expect(mockLive).toHaveBeenCalledWith(expect.objectContaining({ name: "task" }))
    })
  })

  it("re-runs queries debounced on live CREATE", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    const mock = createMockSubscription()
    mockLive.mockResolvedValue(mock.subscription)
    mockQuery.mockResolvedValue(emptyResults)

    renderHook(() => useAnalytics("24h"))

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledTimes(1)
    })

    act(() => {
      mock.emit({
        queryId: "test-uuid",
        action: "CREATE",
        recordId: "task:1",
        value: { id: "task:1", state: "SUCCESS" },
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

  it("does not re-run queries on DELETE", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    const mock = createMockSubscription()
    mockLive.mockResolvedValue(mock.subscription)
    mockQuery.mockResolvedValue(emptyResults)

    renderHook(() => useAnalytics("24h"))

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

    expect(mockQuery).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it("sets error when query fails", async () => {
    mockQuery.mockRejectedValue(new Error("Query failed"))

    const { result } = renderHook(() => useAnalytics("24h"))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toEqual(new Error("Query failed"))
    expect(result.current.data.throughput).toEqual([])
  })

  it("does not run queries when disconnected", async () => {
    mockStatus = "disconnected"

    const { result } = renderHook(() => useAnalytics("24h"))

    // Give time for any async work
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockQuery).not.toHaveBeenCalled()
    expect(result.current.data.throughput).toEqual([])
  })
})
