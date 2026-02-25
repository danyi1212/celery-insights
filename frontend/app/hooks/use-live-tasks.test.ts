import { renderHook, waitFor } from "@testing-library/react"
import { useLiveTasks, useWorkerTasks, useWorkflowTasks, useTask } from "./use-live-tasks"

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
        mockQuery.mockResolvedValue([[]])
        const { subscription } = createMockSubscription()
        mockLive.mockResolvedValue(subscription)
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

    it("subscribes to the task table", async () => {
        renderHook(() => useLiveTasks())

        await waitFor(() => {
            expect(mockLive).toHaveBeenCalledWith("task")
        })
    })
})

describe("useWorkerTasks", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockStatus = "connected"
        mockQuery.mockResolvedValue([[]])
        const { subscription } = createMockSubscription()
        mockLive.mockResolvedValue(subscription)
    })

    it("queries tasks filtered by worker ID", async () => {
        renderHook(() => useWorkerTasks("worker-1"))

        await waitFor(() => {
            expect(mockQuery).toHaveBeenCalledWith(
                "SELECT * FROM task WHERE worker = $workerId ORDER BY last_updated DESC",
                { workerId: "worker-1" },
            )
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
        mockQuery.mockResolvedValue([[]])
        const { subscription } = createMockSubscription()
        mockLive.mockResolvedValue(subscription)
    })

    it("queries tasks by root_id or matching task ID", async () => {
        renderHook(() => useWorkflowTasks("abc-123"))

        await waitFor(() => {
            expect(mockQuery).toHaveBeenCalledWith(
                "SELECT * FROM task WHERE root_id = $rootId OR id = type::thing('task', $rootId)",
                { rootId: "abc-123", rootRecordId: "task:abc-123" },
            )
        })
    })

    it("does not run when rootTaskId is empty", async () => {
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
        mockQuery.mockResolvedValue([[]])
        const { subscription } = createMockSubscription()
        mockLive.mockResolvedValue(subscription)
    })

    it("queries a single task by ID", async () => {
        renderHook(() => useTask("my-task-id"))

        await waitFor(() => {
            expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM type::thing('task', $taskId)", {
                taskId: "my-task-id",
            })
        })
    })

    it("returns task as null when data is empty", async () => {
        mockQuery.mockResolvedValue([[]])

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
        mockQuery.mockResolvedValue([[taskRecord]])

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
