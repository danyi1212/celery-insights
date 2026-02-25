import { renderHook, waitFor } from "@testing-library/react"
import { useLiveEvents, useTaskEvents } from "./use-live-events"

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
        resource: "event",
        kill: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn(() => () => {}),
        [Symbol.asyncIterator]: vi.fn(),
    }
    return { subscription }
}

describe("useLiveEvents", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockStatus = "connected"
        mockQuery.mockResolvedValue([[]])
        const { subscription } = createMockSubscription()
        mockLive.mockResolvedValue(subscription)
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

    it("subscribes to the event table", async () => {
        renderHook(() => useLiveEvents())

        await waitFor(() => {
            expect(mockLive).toHaveBeenCalledWith("event")
        })
    })
})

describe("useTaskEvents", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockStatus = "connected"
        mockQuery.mockResolvedValue([[]])
        const { subscription } = createMockSubscription()
        mockLive.mockResolvedValue(subscription)
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
