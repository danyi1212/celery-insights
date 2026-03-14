import { renderHook, act, waitFor } from "@testing-library/react"
import { useSearch } from "./use-search"

vi.mock("surrealdb", () => ({}))

const mockQuery = vi.fn()
const mockDb = { query: mockQuery }
let mockStatus = "connected"

vi.mock("@components/surrealdb-provider", () => ({
    useSurrealDB: () => ({
        db: mockDb,
        status: mockStatus,
        ingestionStatus: "leader",
        error: null,
    }),
}))

describe("useSearch", () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        vi.clearAllMocks()
        mockStatus = "connected"
        mockQuery.mockResolvedValue([[], []])
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it("returns empty results for empty query without querying DB", async () => {
        const { result } = renderHook(() => useSearch(""))

        // Should not call db.query for empty string
        expect(mockQuery).not.toHaveBeenCalled()
        expect(result.current.tasks).toEqual([])
        expect(result.current.workers).toEqual([])
        expect(result.current.isLoading).toBe(false)
    })

    it("debounces the search query by 300ms", async () => {
        renderHook(() => useSearch("test"))

        // Should not query immediately
        expect(mockQuery).not.toHaveBeenCalled()

        // Advance past debounce timer
        await act(async () => {
            vi.advanceTimersByTime(300)
        })

        await waitFor(() => {
            expect(mockQuery).toHaveBeenCalledTimes(1)
        })
    })

    it("queries both tasks and workers with correct SurrealQL", async () => {
        renderHook(() => useSearch("myquery", 5))

        await act(async () => {
            vi.advanceTimersByTime(300)
        })

        await waitFor(() => {
            expect(mockQuery).toHaveBeenCalledTimes(1)
        })

        const [queryStr, bindings] = mockQuery.mock.calls[0]
        expect(queryStr).toContain("SELECT *,")
        expect(queryStr).toContain("FROM task WHERE")
        expect(queryStr).toContain("FROM workflow WHERE id = type::record('workflow', workflow_id)")
        expect(queryStr).toContain("string::contains")
        expect(queryStr).toContain("SELECT * FROM worker WHERE")
        expect(bindings).toEqual({ q: "myquery", limit: 5 })
    })

    it("returns task and worker results from the query", async () => {
        const tasks = [
            { id: "task:abc", type: "my.task", state: "SUCCESS", last_updated: "2025-01-01T00:00:00Z", children: [] },
        ]
        const workers = [{ id: "worker:w1", status: "online", last_updated: "2025-01-01T00:00:00Z" }]
        mockQuery.mockResolvedValue([tasks, workers])

        const { result } = renderHook(() => useSearch("test"))

        await act(async () => {
            vi.advanceTimersByTime(300)
        })

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.tasks).toEqual(tasks)
        expect(result.current.workers).toEqual(workers)
        expect(result.current.error).toBeNull()
    })

    it("sets error when query fails", async () => {
        mockQuery.mockRejectedValue(new Error("Query failed"))

        const { result } = renderHook(() => useSearch("test"))

        await act(async () => {
            vi.advanceTimersByTime(300)
        })

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.error).toEqual(new Error("Query failed"))
        expect(result.current.tasks).toEqual([])
        expect(result.current.workers).toEqual([])
    })

    it("clears results when query becomes empty", async () => {
        const tasks = [
            { id: "task:abc", type: "my.task", state: "SUCCESS", last_updated: "2025-01-01T00:00:00Z", children: [] },
        ]
        mockQuery.mockResolvedValue([tasks, []])

        const { result, rerender } = renderHook(({ q }) => useSearch(q), {
            initialProps: { q: "test" },
        })

        await act(async () => {
            vi.advanceTimersByTime(300)
        })

        await waitFor(() => {
            expect(result.current.tasks).toHaveLength(1)
        })

        // Clear the query
        rerender({ q: "" })

        expect(result.current.tasks).toEqual([])
        expect(result.current.workers).toEqual([])
        expect(result.current.isLoading).toBe(false)
    })

    it("does not query when not connected", async () => {
        mockStatus = "disconnected"

        renderHook(() => useSearch("test"))

        await act(async () => {
            vi.advanceTimersByTime(500)
        })

        expect(mockQuery).not.toHaveBeenCalled()
    })

    it("cancels previous debounced query when query changes", async () => {
        const { rerender } = renderHook(({ q }) => useSearch(q), {
            initialProps: { q: "first" },
        })

        // Advance partway through debounce
        await act(async () => {
            vi.advanceTimersByTime(200)
        })

        // Change query before debounce fires
        rerender({ q: "second" })

        // Advance past the original debounce time
        await act(async () => {
            vi.advanceTimersByTime(300)
        })

        await waitFor(() => {
            expect(mockQuery).toHaveBeenCalledTimes(1)
        })

        // Should have queried with "second", not "first"
        const [, bindings] = mockQuery.mock.calls[0]
        expect(bindings.q).toBe("second")
    })

    it("uses default limit of 10", async () => {
        renderHook(() => useSearch("test"))

        await act(async () => {
            vi.advanceTimersByTime(300)
        })

        await waitFor(() => {
            expect(mockQuery).toHaveBeenCalledTimes(1)
        })

        const [, bindings] = mockQuery.mock.calls[0]
        expect(bindings.limit).toBe(10)
    })

    it("lowercases the query for case-insensitive search", async () => {
        renderHook(() => useSearch("MyTask"))

        await act(async () => {
            vi.advanceTimersByTime(300)
        })

        await waitFor(() => {
            expect(mockQuery).toHaveBeenCalledTimes(1)
        })

        const [, bindings] = mockQuery.mock.calls[0]
        expect(bindings.q).toBe("mytask")
    })

    it("sets isLoading to true while debouncing and querying", async () => {
        const { result } = renderHook(() => useSearch("test"))

        // Should be loading after setting non-empty query
        expect(result.current.isLoading).toBe(true)

        await act(async () => {
            vi.advanceTimersByTime(300)
        })

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })
    })

    it("handles whitespace-only query as empty", async () => {
        const { result } = renderHook(() => useSearch("   "))

        expect(mockQuery).not.toHaveBeenCalled()
        expect(result.current.tasks).toEqual([])
        expect(result.current.workers).toEqual([])
        expect(result.current.isLoading).toBe(false)
    })
})
