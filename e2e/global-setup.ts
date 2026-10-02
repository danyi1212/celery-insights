import { randomBytes } from "node:crypto"
import http from "node:http"
import { composeLogs, composePs, composeUp } from "./helpers/docker-compose"

const E2E_HOST = process.env.E2E_HOST ?? "127.0.0.1"
const HEALTH_TIMEOUT = 60_000
const HEALTH_INTERVAL = 2_000
const EVENT_WARMUP_TIMEOUT = 60_000
const INSIGHTS_API = `http://${E2E_HOST}:8555/api`
const SURREAL_API = `http://${E2E_HOST}:8555/surreal`
const INTERACTIVE_API = `http://${E2E_HOST}:8000`

type SurrealTaskResult = { result?: Array<Record<string, unknown>> }

type UpgradeProbeResult = {
  outcome: "upgrade" | "response" | "error" | "timeout"
  statusCode?: number
  statusMessage?: string
  headers?: http.IncomingHttpHeaders
  error?: string
}

const logInfo = (message: string) => console.warn(message)

async function pollHealth(url: string, label: string) {
  const deadline = Date.now() + HEALTH_TIMEOUT
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        logInfo(`  ${label} is ready`)
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
  let lastError: string | null = null
  let attempt = 0

  while (Date.now() < deadline) {
    attempt += 1
    const probe = await probeWebSocketUpgrade()
    if (probe.outcome === "upgrade") {
      logInfo("  surreal rpc websocket is ready")
      return
    }

    lastError = JSON.stringify(probe)
    console.warn(`  surreal rpc websocket attempt ${attempt} failed: ${lastError}`)
    await new Promise((r) => setTimeout(r, HEALTH_INTERVAL))
  }

  const reason = lastError ? ` Last error: ${lastError}` : ""
  throw new Error(`Surreal RPC websocket did not become ready within ${HEALTH_TIMEOUT / 1000}s.${reason}`)
}

async function probeWebSocketUpgrade(): Promise<UpgradeProbeResult> {
  return new Promise((resolve) => {
    const req = http.request({
      host: E2E_HOST,
      port: 8555,
      path: "/surreal/rpc",
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": randomBytes(16).toString("base64"),
      },
    })

    const finish = (result: UpgradeProbeResult) => {
      req.removeAllListeners()
      resolve(result)
    }

    req.setTimeout(5_000, () => {
      req.destroy()
      finish({ outcome: "timeout" })
    })

    req.on("upgrade", (_res, socket, head) => {
      socket.destroy()
      finish({
        outcome: "upgrade",
        statusCode: 101,
        statusMessage: "Switching Protocols",
        headers: head.length > 0 ? { "x-head-bytes": String(head.length) } : undefined,
      })
    })

    req.on("response", (res) => {
      res.resume()
      finish({
        outcome: "response",
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        headers: res.headers,
      })
    })

    req.on("error", (error) => {
      finish({ outcome: "error", error: error.message })
    })

    req.end()
  })
}

async function logDiagnostics(stage: string) {
  console.error(`Diagnostics for ${stage}:`)

  const healthChecks = [
    [`${INSIGHTS_API}/settings/info`, "celery-insights settings"],
    [`${INTERACTIVE_API}/scenarios`, "interactive scenarios"],
    [`http://${E2E_HOST}:8555/health`, "bun health"],
    [`${SURREAL_API}/health`, "surreal health"],
  ] as const

  for (const [url, label] of healthChecks) {
    try {
      const res = await fetch(url)
      const body = await res.text()
      console.error(`  ${label}: ${res.status} ${res.statusText} body=${JSON.stringify(body.slice(0, 300))}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`  ${label}: request failed: ${message}`)
    }
  }

  const upgradeProbe = await probeWebSocketUpgrade()
  console.error(`  surreal rpc upgrade probe: ${JSON.stringify(upgradeProbe)}`)
  console.error("  docker compose ps:")
  console.error(composePs())
  console.error("  docker compose logs (celery-insights, interactive):")
  console.error(composeLogs(["celery-insights", "interactive"]))
}

export default async function globalSetup() {
  composeUp()

  try {
    logInfo("Waiting for services to be healthy...")
    await Promise.all([
      pollHealth(`${INSIGHTS_API}/settings/info`, "celery-insights"),
      pollHealth(`${INTERACTIVE_API}/scenarios`, "interactive API"),
    ])
    await waitForSurrealRpcReady()
    await warmupEventStream()
    logInfo("All services healthy. Starting tests.")
  } catch (error) {
    await logDiagnostics("global setup failure")
    throw error
  }
}
