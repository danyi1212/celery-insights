import { composeUp } from "./helpers/docker-compose"

const HEALTH_TIMEOUT = 60_000
const HEALTH_INTERVAL = 2_000
const EVENT_WARMUP_TIMEOUT = 60_000
const INSIGHTS_API = "http://localhost:8555/api"
const INTERACTIVE_API = "http://localhost:8000"

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
    while (Date.now() < deadline) {
        try {
            const res = await fetch(`${INSIGHTS_API}/tasks/${taskId}`)
            if (res.ok) return true
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

export default async function globalSetup() {
    composeUp()

    console.log("Waiting for services to be healthy...")
    await Promise.all([
        pollHealth(`${INSIGHTS_API}/settings/info`, "celery-insights"),
        pollHealth(`${INTERACTIVE_API}/scenarios`, "interactive API"),
    ])
    await warmupEventStream()
    console.log("All services healthy. Starting tests.")
}
