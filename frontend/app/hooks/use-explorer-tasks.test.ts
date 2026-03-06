import { renderHook, waitFor } from "@testing-library/react"
import { useExplorerTasks, type ExplorerFilters, type SortConfig } from "./use-explorer-tasks"

vi.mock("surrealdb", () => ({
    Table: class {
        name: string
        constructor(name: string) {
            this.name = name
        }
    },
}))

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
    const subscription = {
        id: "test-uuid",
        isManaged: true,
        isAlive: true,
        resource: "task",
        kill: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn(() => () => {}),
        [Symbol.asyncIterator]: vi.fn(),
    }
    return { subscription }
}

describe("useExplorerTasks", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockStatus = "connected"
        // Return 5 query results: data, count, state facets, type facets, worker facets
        mockQuery.mockResolvedValue([[], [{ count: 0 }], [], [], []])
        const { subscription } = createMockSubscription()
        mockLive.mockResolvedValue(subscription)
    })

    it("runs queries without filters", async () => {
        const filters: ExplorerFilters = {}
        renderHook(() => useExplorerTasks(filters))

        await waitFor(() => {
            expect(mockQuery).toHaveBeenCalled()
        })

        const [query, bindings] = mockQuery.mock.calls[0]
        expect(query).toContain("SELECT * FROM task ORDER BY last_updated DESC LIMIT $pageSize START $offset")
        expect(bindings).toMatchObject({ pageSize: 50, offset: 0 })
    })

    it("builds WHERE clause from state filters", async () => {
        const filters: ExplorerFilters = { states: ["SUCCESS", "FAILURE"] }
        renderHook(() => useExplorerTasks(filters))

        await waitFor(() => {
            expect(mockQuery).toHaveBeenCalled()
        })

        const [query, bindings] = mockQuery.mock.calls[0]
        expect(query).toContain("WHERE state IN $states")
        expect(bindings.states).toEqual(["SUCCESS", "FAILURE"])
    })

    it("builds WHERE clause from multiple filters", async () => {
        const filters: ExplorerFilters = {
            states: ["SUCCESS"],
            types: ["tasks.add"],
            workers: ["celery@host"],
        }
        renderHook(() => useExplorerTasks(filters))

        await waitFor(() => {
            expect(mockQuery).toHaveBeenCalled()
        })

        const [query, bindings] = mockQuery.mock.calls[0]
        expect(query).toContain("state IN $states AND type IN $types AND worker IN $workers")
        expect(bindings.states).toEqual(["SUCCESS"])
        expect(bindings.types).toEqual(["tasks.add"])
        expect(bindings.workers).toEqual(["celery@host"])
    })

    it("applies custom sort config", async () => {
        const filters: ExplorerFilters = {}
        const sort: SortConfig = { field: "sent_at", direction: "ASC" }
        renderHook(() => useExplorerTasks(filters, sort))

        await waitFor(() => {
            expect(mockQuery).toHaveBeenCalled()
        })

        const [query] = mockQuery.mock.calls[0]
        expect(query).toContain("ORDER BY sent_at ASC")
    })

    it("applies pagination offset", async () => {
        const filters: ExplorerFilters = {}
        const sort: SortConfig = { field: "last_updated", direction: "DESC" }
        renderHook(() => useExplorerTasks(filters, sort, 3, 25))

        await waitFor(() => {
            expect(mockQuery).toHaveBeenCalled()
        })

        const [, bindings] = mockQuery.mock.calls[0]
        expect(bindings.pageSize).toBe(25)
        expect(bindings.offset).toBe(50) // (page 3 - 1) * 25
    })

    it("returns facet counts", async () => {
        mockQuery.mockResolvedValue([
            [{ id: "task:1", state: "SUCCESS", last_updated: "2024-01-01T00:00:00Z", children: [] }],
            [{ count: 1 }],
            [{ state: "SUCCESS", count: 1 }],
            [{ type: "tasks.add", count: 1 }],
            [{ worker: "celery@host", count: 1 }],
        ])

        const filters: ExplorerFilters = {}
        const { result } = renderHook(() => useExplorerTasks(filters))

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.total).toBe(1)
        expect(result.current.facets.state).toEqual({ SUCCESS: 1 })
        expect(result.current.facets.type).toEqual({ "tasks.add": 1 })
        expect(result.current.facets.worker).toEqual({ "celery@host": 1 })
    })

    it("subscribes to task table for live refresh", async () => {
        const filters: ExplorerFilters = {}
        renderHook(() => useExplorerTasks(filters))

        await waitFor(() => {
            expect(mockLive).toHaveBeenCalledWith(expect.objectContaining({ name: "task" }))
        })
    })

    it("sets error when query fails", async () => {
        mockQuery.mockRejectedValue(new Error("Query failed"))

        const filters: ExplorerFilters = {}
        const { result } = renderHook(() => useExplorerTasks(filters))

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.error).toEqual(new Error("Query failed"))
    })
})
