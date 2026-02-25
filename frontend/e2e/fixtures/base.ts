import { test as base } from "@playwright/test"
import { ScenarioClient } from "../helpers/scenario-client"

const INSIGHTS_API = "http://localhost:8555/api"

type TaskState = "PENDING" | "RECEIVED" | "STARTED" | "SUCCESS" | "FAILURE" | "RETRY" | "REVOKED"
type TaskSummary = {
    id: string
    root_id?: string | null
    parent_id?: string | null
    children?: string[] | null
}
type Paginated<T> = { results: T[] }

export const test = base.extend<{
    scenario: ScenarioClient
    waitForTask: (taskId: string, states: TaskState[], opts?: { timeout?: number; interval?: number }) => Promise<void>
    waitForTaskVisible: (taskId: string, opts?: { timeout?: number; interval?: number }) => Promise<void>
}>({
    scenario: async ({}, use) => {
        await use(new ScenarioClient())
    },

    waitForTask: async ({}, use) => {
        await use(async (taskId, states, opts) => {
            const timeout = opts?.timeout ?? 15_000
            const interval = opts?.interval ?? 500
            const deadline = Date.now() + timeout
            while (Date.now() < deadline) {
                try {
                    const res = await fetch(`${INSIGHTS_API}/tasks/${taskId}`)
                    if (res.ok) {
                        const data = await res.json()
                        if (states.includes(data.state)) return
                    }
                } catch {
                    // not available yet
                }
                await new Promise((r) => setTimeout(r, interval))
            }
            throw new Error(`Task ${taskId} did not reach ${states.join("/")} within ${timeout}ms`)
        })
    },

    waitForTaskVisible: async ({}, use) => {
        await use(async (taskId, opts) => {
            const timeout = opts?.timeout ?? 15_000
            const interval = opts?.interval ?? 500
            const deadline = Date.now() + timeout
            while (Date.now() < deadline) {
                try {
                    const res = await fetch(`${INSIGHTS_API}/tasks/${taskId}`)
                    if (res.ok) return
                    const listRes = await fetch(`${INSIGHTS_API}/tasks?limit=1000`)
                    if (listRes.ok) {
                        const data = (await listRes.json()) as Paginated<TaskSummary>
                        const relatedTask = data.results?.some(
                            (task) =>
                                task.id === taskId ||
                                task.root_id === taskId ||
                                task.parent_id === taskId ||
                                task.children?.includes(taskId),
                        )
                        if (relatedTask) return
                    }
                } catch {
                    // not available yet
                }
                await new Promise((r) => setTimeout(r, interval))
            }
            throw new Error(`Task ${taskId} not visible within ${timeout}ms`)
        })
    },
})

export { expect } from "@playwright/test"
