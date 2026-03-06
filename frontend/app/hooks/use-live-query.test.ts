import { renderHook, act, waitFor } from "@testing-library/react"
import { useLiveQuery } from "./use-live-query"

// Prevent the heavy surrealdb module from loading (WASM + large SDK)
vi.mock("surrealdb", () => ({}))

type LiveMessage = {
    queryId: unknown
    action: "CREATE" | "UPDATE" | "DELETE" | "KILLED"
    recordId: unknown
    value: Record<string, unknown>
}

// Mock the surrealdb-provider module with a STABLE db reference
const mockQuery = vi.fn()
const mockLiveOf = vi.fn()
const MOCK_LIVE_UUID = "mock-live-uuid"
// Stable object reference — must not be recreated between renders
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

type TestRecord = { id: string; name: string; score: number }

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
    const handlers: Array<(message: LiveMessage) => void> = []
    const subscription = {
        id: MOCK_LIVE_UUID,
        isManaged: false,
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

function makeLiveMessage(action: "CREATE" | "UPDATE" | "DELETE", record: TestRecord): LiveMessage {
    return {
        queryId: MOCK_LIVE_UUID,
        action,
        recordId: record.id,
        value: record as unknown as Record<string, unknown>,
    }
}

describe("useLiveQuery", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockStatus = "connected"
        setInitialQueryResult([[]])
        const { subscription } = createMockSubscription()
        mockLiveOf.mockResolvedValue(subscription)
    })

    it("runs initial query and returns data", async () => {
        const records: TestRecord[] = [
            { id: "task:1", name: "alpha", score: 10 },
            { id: "task:2", name: "beta", score: 20 },
        ]
        setInitialQueryResult([records])

        const { result } = renderHook(() =>
            useLiveQuery<TestRecord>({
                initialQuery: "SELECT * FROM task ORDER BY score DESC",
                liveTable: "task",
            }),
        )

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.data).toEqual(records)
        expect(result.current.error).toBeNull()
        expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM task ORDER BY score DESC", undefined)
    })

    it("passes bindings to the initial query", async () => {
        const bindings = { workerId: "worker:abc" }
        renderHook(() =>
            useLiveQuery<TestRecord>({
                initialQuery: "SELECT * FROM task WHERE worker = $workerId",
                liveTable: "task",
                bindings,
            }),
        )

        await waitFor(() => {
            expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM task WHERE worker = $workerId", bindings)
        })
    })

    it("starts a live subscription on the specified table", async () => {
        renderHook(() =>
            useLiveQuery<TestRecord>({
                initialQuery: "SELECT * FROM task",
                liveTable: "task",
            }),
        )

        await waitFor(() => {
            expect(mockQuery).toHaveBeenCalledWith("LIVE SELECT * FROM task")
            expect(mockLiveOf).toHaveBeenCalledWith(MOCK_LIVE_UUID)
        })
    })

    it("handles CREATE notifications by adding records", async () => {
        const mock = createMockSubscription()
        mockLiveOf.mockResolvedValue(mock.subscription)

        const { result } = renderHook(() =>
            useLiveQuery<TestRecord>({
                initialQuery: "SELECT * FROM task",
                liveTable: "task",
            }),
        )

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        const newRecord: TestRecord = { id: "task:1", name: "alpha", score: 10 }
        act(() => {
            mock.emit(makeLiveMessage("CREATE", newRecord))
        })

        expect(result.current.data).toEqual([newRecord])
    })

    it("handles UPDATE notifications by replacing records", async () => {
        const initial: TestRecord[] = [{ id: "task:1", name: "alpha", score: 10 }]
        setInitialQueryResult([initial])
        const mock = createMockSubscription()
        mockLiveOf.mockResolvedValue(mock.subscription)

        const { result } = renderHook(() =>
            useLiveQuery<TestRecord>({
                initialQuery: "SELECT * FROM task",
                liveTable: "task",
            }),
        )

        await waitFor(() => {
            expect(result.current.data).toEqual(initial)
        })

        const updated: TestRecord = { id: "task:1", name: "alpha-updated", score: 99 }
        act(() => {
            mock.emit(makeLiveMessage("UPDATE", updated))
        })

        expect(result.current.data).toEqual([updated])
    })

    it("handles UPDATE for records not in current list by adding them", async () => {
        const mock = createMockSubscription()
        mockLiveOf.mockResolvedValue(mock.subscription)

        const { result } = renderHook(() =>
            useLiveQuery<TestRecord>({
                initialQuery: "SELECT * FROM task",
                liveTable: "task",
            }),
        )

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        const record: TestRecord = { id: "task:new", name: "new-record", score: 50 }
        act(() => {
            mock.emit(makeLiveMessage("UPDATE", record))
        })

        expect(result.current.data).toEqual([record])
    })

    it("handles DELETE notifications by removing records", async () => {
        const initial: TestRecord[] = [
            { id: "task:1", name: "alpha", score: 10 },
            { id: "task:2", name: "beta", score: 20 },
        ]
        setInitialQueryResult([initial])
        const mock = createMockSubscription()
        mockLiveOf.mockResolvedValue(mock.subscription)

        const { result } = renderHook(() =>
            useLiveQuery<TestRecord>({
                initialQuery: "SELECT * FROM task",
                liveTable: "task",
            }),
        )

        await waitFor(() => {
            expect(result.current.data).toHaveLength(2)
        })

        act(() => {
            mock.emit(makeLiveMessage("DELETE", { id: "task:1", name: "alpha", score: 10 }))
        })

        expect(result.current.data).toEqual([{ id: "task:2", name: "beta", score: 20 }])
    })

    it("does not duplicate records on CREATE if already present", async () => {
        const initial: TestRecord[] = [{ id: "task:1", name: "alpha", score: 10 }]
        setInitialQueryResult([initial])
        const mock = createMockSubscription()
        mockLiveOf.mockResolvedValue(mock.subscription)

        const { result } = renderHook(() =>
            useLiveQuery<TestRecord>({
                initialQuery: "SELECT * FROM task",
                liveTable: "task",
            }),
        )

        await waitFor(() => {
            expect(result.current.data).toHaveLength(1)
        })

        act(() => {
            mock.emit(makeLiveMessage("CREATE", { id: "task:1", name: "alpha", score: 10 }))
        })

        expect(result.current.data).toHaveLength(1)
    })

    it("applies orderBy after live patches", async () => {
        const initial: TestRecord[] = [{ id: "task:1", name: "alpha", score: 10 }]
        setInitialQueryResult([initial])
        const mock = createMockSubscription()
        mockLiveOf.mockResolvedValue(mock.subscription)

        const { result } = renderHook(() =>
            useLiveQuery<TestRecord>({
                initialQuery: "SELECT * FROM task ORDER BY score DESC",
                liveTable: "task",
                orderBy: (a, b) => b.score - a.score,
            }),
        )

        await waitFor(() => {
            expect(result.current.data).toHaveLength(1)
        })

        act(() => {
            mock.emit(makeLiveMessage("CREATE", { id: "task:2", name: "beta", score: 99 }))
        })

        expect(result.current.data[0].id).toBe("task:2")
        expect(result.current.data[1].id).toBe("task:1")
    })

    it("applies limit after sorting", async () => {
        const initial: TestRecord[] = [
            { id: "task:1", name: "alpha", score: 10 },
            { id: "task:2", name: "beta", score: 20 },
        ]
        setInitialQueryResult([initial])
        const mock = createMockSubscription()
        mockLiveOf.mockResolvedValue(mock.subscription)

        const { result } = renderHook(() =>
            useLiveQuery<TestRecord>({
                initialQuery: "SELECT * FROM task ORDER BY score DESC LIMIT 2",
                liveTable: "task",
                orderBy: (a, b) => b.score - a.score,
                limit: 2,
            }),
        )

        await waitFor(() => {
            expect(result.current.data).toHaveLength(2)
        })

        act(() => {
            mock.emit(makeLiveMessage("CREATE", { id: "task:3", name: "gamma", score: 99 }))
        })

        expect(result.current.data).toHaveLength(2)
        expect(result.current.data[0].id).toBe("task:3")
        expect(result.current.data[1].id).toBe("task:2")
    })

    it("sets error when initial query fails", async () => {
        mockQuery.mockRejectedValue(new Error("Query failed"))

        const { result } = renderHook(() =>
            useLiveQuery<TestRecord>({
                initialQuery: "SELECT * FROM task",
                liveTable: "task",
            }),
        )

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.error).toEqual(new Error("Query failed"))
        expect(result.current.data).toEqual([])
    })

    it("does not run when enabled is false", async () => {
        const { result } = renderHook(() =>
            useLiveQuery<TestRecord>({
                initialQuery: "SELECT * FROM task",
                liveTable: "task",
                enabled: false,
            }),
        )

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(mockQuery).not.toHaveBeenCalled()
        expect(mockLiveOf).not.toHaveBeenCalled()
        expect(result.current.data).toEqual([])
    })

    it("does not run when status is not connected", async () => {
        mockStatus = "disconnected"

        const { result } = renderHook(() =>
            useLiveQuery<TestRecord>({
                initialQuery: "SELECT * FROM task",
                liveTable: "task",
            }),
        )

        // Should stay in loading state since we never connect
        expect(result.current.isLoading).toBe(true)
        expect(mockQuery).not.toHaveBeenCalled()
        expect(mockLiveOf).not.toHaveBeenCalled()
    })

    it("kills subscription on unmount", async () => {
        const mock = createMockSubscription()
        mockLiveOf.mockResolvedValue(mock.subscription)

        const { unmount } = renderHook(() =>
            useLiveQuery<TestRecord>({
                initialQuery: "SELECT * FROM task",
                liveTable: "task",
            }),
        )

        await waitFor(() => {
            expect(mockLiveOf).toHaveBeenCalled()
        })

        unmount()

        expect(mock.subscription.kill).toHaveBeenCalled()
    })

    it("normalizes single-object result from record-specific SELECT", async () => {
        // SurrealDB JS SDK v2 returns a single object (not array) for
        // SELECT * FROM $rid (record-specific SELECT) — useLiveQuery normalizes it to an array
        const singleRecord: TestRecord = { id: "task:abc", name: "single", score: 42 }
        setInitialQueryResult([singleRecord])

        const bindings = { rid: "task:abc" }
        const { result } = renderHook(() =>
            useLiveQuery<TestRecord>({
                initialQuery: "SELECT * FROM $rid",
                liveTable: "task",
                bindings,
            }),
        )

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.data).toEqual([singleRecord])
    })

    it("returns empty array when record-specific SELECT returns null/undefined", async () => {
        // When the record doesn't exist, the SDK returns undefined for the statement result
        setInitialQueryResult([undefined])

        const bindings = { rid: "task:nonexistent" }
        const { result } = renderHook(() =>
            useLiveQuery<TestRecord>({
                initialQuery: "SELECT * FROM $rid",
                liveTable: "task",
                bindings,
            }),
        )

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.data).toEqual([])
    })

    it("handles DELETE for non-existent records without changing data", async () => {
        const initial: TestRecord[] = [{ id: "task:1", name: "alpha", score: 10 }]
        setInitialQueryResult([initial])
        const mock = createMockSubscription()
        mockLiveOf.mockResolvedValue(mock.subscription)

        const { result } = renderHook(() =>
            useLiveQuery<TestRecord>({
                initialQuery: "SELECT * FROM task",
                liveTable: "task",
            }),
        )

        await waitFor(() => {
            expect(result.current.data).toHaveLength(1)
        })

        const prevData = result.current.data

        act(() => {
            mock.emit(makeLiveMessage("DELETE", { id: "task:nonexistent", name: "", score: 0 }))
        })

        // Should return the same reference since nothing changed
        expect(result.current.data).toBe(prevData)
    })
})
