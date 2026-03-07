import { test as base } from "@playwright/test"
import { ScenarioClient } from "../helpers/scenario-client"

const E2E_HOST = process.env.E2E_HOST ?? "127.0.0.1"
const SURREAL_API = `http://${E2E_HOST}:8555/surreal`

type TaskState = "PENDING" | "RECEIVED" | "STARTED" | "SUCCESS" | "FAILURE" | "RETRY" | "REVOKED"
type SurrealStateResult = { result?: Array<{ state?: TaskState }> }
type SurrealTaskResult = { result?: Array<Record<string, unknown>> }

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
            const query = `USE NS celery_insights DB main; SELECT state FROM task:⟨${taskId}⟩`

            while (Date.now() < deadline) {
                try {
                    const res = await fetch(`${SURREAL_API}/sql`, {
                        method: "POST",
                        headers: {
                            Accept: "application/json",
                            Authorization: "Basic " + btoa("root:root"),
                        },
                        body: query,
                    })
                    if (res.ok) {
                        const data = (await res.json()) as SurrealStateResult[]
                        const state = data?.[1]?.result?.[0]?.state
                        if (state && states.includes(state)) return
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
            const query = `USE NS celery_insights DB main; SELECT id, root_id, parent_id, children FROM task WHERE id = task:⟨${taskId}⟩ OR root_id = '${taskId}' OR parent_id = '${taskId}' OR '${taskId}' IN children`

            while (Date.now() < deadline) {
                try {
                    const res = await fetch(`${SURREAL_API}/sql`, {
                        method: "POST",
                        headers: {
                            Accept: "application/json",
                            Authorization: "Basic " + btoa("root:root"),
                        },
                        body: query,
                    })
                    if (res.ok) {
                        const data = (await res.json()) as SurrealTaskResult[]
                        if (data?.[1]?.result?.length > 0) return
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
