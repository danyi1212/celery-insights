import { composeUp } from "./helpers/docker-compose"

const E2E_HOST = process.env.E2E_HOST ?? "127.0.0.1"
const HEALTH_TIMEOUT = 60_000
const HEALTH_INTERVAL = 2_000
const EVENT_WARMUP_TIMEOUT = 60_000
const INSIGHTS_API = `http://${E2E_HOST}:8555/api`
const SURREAL_API = `http://${E2E_HOST}:8555/surreal`
const INTERACTIVE_API = `http://${E2E_HOST}:8000`

type SurrealTaskResult = { result?: Array<Record<string, unknown>> }

async function pollHealth(url: string, label: string) {
    const deadline = Date.now() + HEALTH_TIMEOUT
    while (Date.now() < deadline) {
        try {
            const res = await fetch(url)
            if (res.ok) {
                console.log(`  ${label} is ready`)
                return
            }
        } catch {
            // not ready yet
        }
        await new Promise((r) => setTimeout(r, HEALTH_INTERVAL))
    }
    throw new Error(`${label} did not become healthy within ${HEALTH_TIMEOUT / 1000}s`)
}

async function waitForTaskVisible(taskId: string, timeout: number) {
    const deadline = Date.now() + timeout
    // Use ⟨ ⟩ brackets to match SurrealDB UUID record IDs in this env.
    const query = `USE NS celery_insights DB main; SELECT * FROM task:⟨${taskId}⟩`

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
                // The result for the SELECT will be in the second element of the array (after USE)
                if (data?.[1]?.result?.[0]) {
                    return true
                }
            }
        } catch {
            // event stream not ready yet
        }
        await new Promise((r) => setTimeout(r, HEALTH_INTERVAL))
    }
    return false
}

async function warmupEventStream() {
    const deadline = Date.now() + EVENT_WARMUP_TIMEOUT
    while (Date.now() < deadline) {
        try {
            const res = await fetch(`${INTERACTIVE_API}/scenarios/noop`, { method: "POST" })
            if (res.ok) {
                const data = (await res.json()) as { task_id?: string }
                if (data.task_id) {
                    const visible = await waitForTaskVisible(data.task_id, 10_000)
                    if (visible) return
                }
            }
        } catch {
            // services may not be ready yet
        }
        await new Promise((r) => setTimeout(r, HEALTH_INTERVAL))
    }
    throw new Error(`Event stream did not become ready within ${EVENT_WARMUP_TIMEOUT / 1000}s`)
}

async function waitForSurrealRpcReady() {
    const deadline = Date.now() + HEALTH_TIMEOUT
    let lastError: Error | null = null

    while (Date.now() < deadline) {
        try {
            await new Promise<void>((resolve, reject) => {
                let settled = false
                const ws = new WebSocket(`ws://${E2E_HOST}:8555/surreal/rpc`)
                const timeout = setTimeout(() => {
                    if (!settled) {
                        settled = true
                        ws.close()
                        reject(new Error("websocket timeout"))
                    }
                }, 5_000)

                ws.onopen = () => {
                    if (!settled) {
                        settled = true
                        clearTimeout(timeout)
                        ws.close()
                        resolve()
                    }
                }
                ws.onerror = () => {
                    if (!settled) {
                        settled = true
                        clearTimeout(timeout)
                        reject(new Error("websocket error"))
                    }
                }
                ws.onclose = () => {
                    if (!settled) {
                        settled = true
                        clearTimeout(timeout)
                        reject(new Error("websocket closed before open"))
                    }
                }
            })
            console.log("  surreal rpc websocket is ready")
            return
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))
            await new Promise((r) => setTimeout(r, HEALTH_INTERVAL))
        }
    }

    const reason = lastError ? ` Last error: ${lastError.message}` : ""
    throw new Error(`Surreal RPC websocket did not become ready within ${HEALTH_TIMEOUT / 1000}s.${reason}`)
}

export default async function globalSetup() {
    composeUp()

    console.log("Waiting for services to be healthy...")
    await Promise.all([
        pollHealth(`${INSIGHTS_API}/settings/info`, "celery-insights"),
        pollHealth(`${INTERACTIVE_API}/scenarios`, "interactive API"),
    ])
    await waitForSurrealRpcReady()
    await warmupEventStream()
    console.log("All services healthy. Starting tests.")
}
