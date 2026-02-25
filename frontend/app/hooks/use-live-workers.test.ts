import { renderHook, waitFor } from "@testing-library/react"
import { useLiveWorkers, useWorker, useOnlineWorkers } from "./use-live-workers"

vi.mock("surrealdb", () => ({}))

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
        mockQuery.mockResolvedValue([[]])
        const { subscription } = createMockSubscription()
        mockLive.mockResolvedValue(subscription)
    })

    it("queries all workers ordered by last_updated DESC", async () => {
        renderHook(() => useLiveWorkers())

        await waitFor(() => {
            expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM worker ORDER BY last_updated DESC", undefined)
        })
    })

    it("subscribes to the worker table", async () => {
        renderHook(() => useLiveWorkers())

        await waitFor(() => {
            expect(mockLive).toHaveBeenCalledWith("worker")
        })
    })
})

describe("useWorker", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockStatus = "connected"
        mockQuery.mockResolvedValue([[]])
        const { subscription } = createMockSubscription()
        mockLive.mockResolvedValue(subscription)
    })

    it("queries a single worker by ID", async () => {
        renderHook(() => useWorker("celery@myhost"))

        await waitFor(() => {
            expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM type::thing('worker', $workerId)", {
                workerId: "celery@myhost",
            })
        })
    })

    it("returns worker as null when data is empty", async () => {
        mockQuery.mockResolvedValue([[]])

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
        mockQuery.mockResolvedValue([[workerRecord]])

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
        mockQuery.mockResolvedValue([[]])
        const { subscription } = createMockSubscription()
        mockLive.mockResolvedValue(subscription)
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

    it("filters data to only include online workers", async () => {
        const workers = [
            { id: "worker:1", status: "online", last_updated: "2024-01-01T00:00:00Z" },
            { id: "worker:2", status: "offline", last_updated: "2024-01-01T00:00:00Z" },
        ]
        mockQuery.mockResolvedValue([workers])

        const { result } = renderHook(() => useOnlineWorkers())

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        // Client-side filter should remove the offline worker
        expect(result.current.data).toHaveLength(1)
        expect(result.current.data[0].id).toBe("worker:1")
    })
})
