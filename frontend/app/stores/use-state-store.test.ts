import { TaskState } from "@services/server"
import { createServerTask, createTaskEventMessage, createWorkerEventMessage } from "@test-fixtures"
import { translateTask } from "@utils/translate-server-models"
import { useStateStore, handleEvent, resetState } from "./use-state-store"

const getState = () => useStateStore.getState()

beforeEach(() => {
    resetState()
})

describe("handleEvent — task", () => {
    it("adds a new task to the store", () => {
        handleEvent(createTaskEventMessage({ id: "task-1" }))

        expect(getState().tasks.get("task-1")).toBeDefined()
        expect(getState().tasks.get("task-1")!.id).toBe("task-1")
    })

    it("translates the server task before storing", () => {
        const serverTask = createServerTask({ id: "task-1" })
        handleEvent(createTaskEventMessage({ id: "task-1" }))

        const stored = getState().tasks.get("task-1")!
        const expected = translateTask(serverTask)
        expect(stored).toEqual(expected)
    })

    it("adds task id to recentTaskIds", () => {
        handleEvent(createTaskEventMessage({ id: "task-1" }))

        expect(getState().recentTaskIds).toContain("task-1")
    })

    it("prepends new task ids (most recent first)", () => {
        handleEvent(createTaskEventMessage({ id: "task-1" }))
        handleEvent(createTaskEventMessage({ id: "task-2" }))

        expect(getState().recentTaskIds).toEqual(["task-2", "task-1"])
    })

    it("does not duplicate task id in recentTaskIds when updating existing task", () => {
        handleEvent(createTaskEventMessage({ id: "task-1", state: TaskState.STARTED }))
        handleEvent(createTaskEventMessage({ id: "task-1", state: TaskState.SUCCESS }))

        const ids = getState().recentTaskIds.filter((id) => id === "task-1")
        expect(ids).toHaveLength(1)
    })

    it("caps recentTaskIds at recentTasksCapacity", () => {
        const capacity = getState().recentTasksCapacity

        for (let i = 0; i < capacity + 5; i++) {
            handleEvent(createTaskEventMessage({ id: `task-${i}` }))
        }

        expect(getState().recentTaskIds).toHaveLength(capacity)
    })

    it("updates an existing task in the store", () => {
        handleEvent(createTaskEventMessage({ id: "task-1", state: TaskState.STARTED }))
        handleEvent(createTaskEventMessage({ id: "task-1", state: TaskState.SUCCESS }))

        expect(getState().tasks.get("task-1")!.state).toBe(TaskState.SUCCESS)
    })
})

describe("handleEvent — worker", () => {
    it("adds a new worker to the store", () => {
        handleEvent(createWorkerEventMessage({ id: "worker-1@host" }))

        expect(getState().workers.get("worker-1@host")).toBeDefined()
    })

    it("translates the server worker before storing", () => {
        handleEvent(createWorkerEventMessage({ id: "worker-1@host" }))

        const stored = getState().workers.get("worker-1@host")!
        expect(stored.id).toBe("worker-1@host")
        expect(stored.lastUpdated).toBeInstanceOf(Date)
    })

    it("updates an existing worker", () => {
        handleEvent(createWorkerEventMessage({ id: "worker-1@host", active_tasks: 2 }))
        handleEvent(createWorkerEventMessage({ id: "worker-1@host", active_tasks: 5 }))

        expect(getState().workers.get("worker-1@host")!.activeTasks).toBe(5)
    })
})

describe("resetState", () => {
    it("clears all tasks, workers, and recentTaskIds", () => {
        handleEvent(createTaskEventMessage({ id: "task-1" }))
        handleEvent(createWorkerEventMessage({ id: "worker-1@host" }))

        resetState()

        expect(getState().tasks.size).toBe(0)
        expect(getState().workers.size).toBe(0)
        expect(getState().recentTaskIds).toEqual([])
    })
})
