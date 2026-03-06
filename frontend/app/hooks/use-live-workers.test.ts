import { renderHook, waitFor } from "@testing-library/react"
import { useLiveWorkers, useWorker, useOnlineWorkers } from "./use-live-workers"

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
        resource: "worker",
        kill: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn(() => () => {}),
        [Symbol.asyncIterator]: vi.fn(),
    }
    return { subscription }
}

describe("useLiveWorkers", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockStatus = "connected"
        setInitialQueryResult([[]])
        const { subscription } = createMockSubscription()
        mockLiveOf.mockResolvedValue(subscription)
    })

    it("queries all workers ordered by last_updated DESC", async () => {
        renderHook(() => useLiveWorkers())

        await waitFor(() => {
            expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM worker ORDER BY last_updated DESC", undefined)
        })
    })

    it("subscribes to the worker table via LIVE SELECT", async () => {
        renderHook(() => useLiveWorkers())

        await waitFor(() => {
            expect(mockQuery).toHaveBeenCalledWith("LIVE SELECT * FROM worker")
            expect(mockLiveOf).toHaveBeenCalledWith(MOCK_LIVE_UUID)
        })
    })
})

describe("useWorker", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockStatus = "connected"
        setInitialQueryResult([[]])
        const { subscription } = createMockSubscription()
        mockLiveOf.mockResolvedValue(subscription)
    })

    it("queries a single worker by ID using RecordId binding", async () => {
        renderHook(() => useWorker("celery@myhost"))

        await waitFor(() => {
            expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM $rid", expect.objectContaining({}))
            const bindings = mockQuery.mock.calls[0][1]
            expect(bindings.rid).toEqual(expect.objectContaining({ tb: "worker", id: "celery@myhost" }))
        })
    })

    it("returns worker as null when data is empty", async () => {
        const { result } = renderHook(() => useWorker("celery@myhost"))

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.worker).toBeNull()
    })

    it("returns worker from data array", async () => {
        const workerRecord = {
            id: "worker:celery@myhost",
            status: "online",
            last_updated: "2024-01-01T00:00:00Z",
        }
        setInitialQueryResult([[workerRecord]])

        const { result } = renderHook(() => useWorker("celery@myhost"))

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.worker).toEqual(workerRecord)
    })

    it("returns worker when SDK returns single object (record-specific SELECT)", async () => {
        const workerRecord = {
            id: "worker:celery@myhost",
            status: "online",
            last_updated: "2024-01-01T00:00:00Z",
        }
        // SurrealDB JS SDK v2 returns a single object (not array) for
        // SELECT * FROM $rid (record-specific SELECT) — useLiveQuery normalizes it to an array
        setInitialQueryResult([workerRecord])

        const { result } = renderHook(() => useWorker("celery@myhost"))

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.worker).toEqual(workerRecord)
    })

    it("does not run when workerId is empty", async () => {
        renderHook(() => useWorker(""))

        await waitFor(() => {
            expect(mockQuery).not.toHaveBeenCalled()
        })
    })
})

describe("useOnlineWorkers", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockStatus = "connected"
        setInitialQueryResult([[]])
        const { subscription } = createMockSubscription()
        mockLiveOf.mockResolvedValue(subscription)
    })

    it("queries workers with status online", async () => {
        renderHook(() => useOnlineWorkers())

        await waitFor(() => {
            expect(mockQuery).toHaveBeenCalledWith(
                "SELECT * FROM worker WHERE status = 'online' ORDER BY last_updated DESC",
                undefined,
            )
        })
    })

    it("returns only online workers from initial query", async () => {
        // The initial query has WHERE status = 'online', so only online workers are returned
        const workers = [{ id: "worker:1", status: "online", last_updated: "2024-01-01T00:00:00Z" }]
        setInitialQueryResult([workers])

        const { result } = renderHook(() => useOnlineWorkers())

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.data).toHaveLength(1)
        expect(result.current.data[0].id).toBe("worker:1")
    })
})
