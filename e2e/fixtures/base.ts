import { privateObservationQuery } from "../helpers/docker-compose"
import { appPath, appOrigin, appURL, urlPrefix } from "../helpers/app-url"
import { expect, test as base } from "../../tooling/playwright"
import { ScenarioClient } from "../helpers/scenario-client"

type TaskState = "PENDING" | "RECEIVED" | "STARTED" | "SUCCESS" | "FAILURE" | "RETRY" | "REVOKED"
type SurrealStateResult = { result?: Array<{ state?: TaskState }> }
type SurrealTaskResult = { result?: Array<Record<string, unknown>> }

export const test = base.extend<{
  scenario: ScenarioClient
  waitForTask: (taskId: string, states: TaskState[], opts?: { timeout?: number; interval?: number }) => Promise<void>
  waitForTaskVisible: (taskId: string, opts?: { timeout?: number; interval?: number }) => Promise<void>
}>({
  request: async ({ playwright }, use) => {
    const request = await playwright.request.newContext({
      ignoreHTTPSErrors: true,
      httpCredentials: {
        username: "admin",
        password: "synthetic-ci-configured-password",
        origin: appOrigin,
        send: "always",
      },
    })
    try {
      await use(request)
    } finally {
      await request.dispose()
    }
  },
  page: async ({ page }, use) => {
    // Establish the real browser session, rather than relying on a Basic credential cache.
    await page.goto(appURL("/login"))
    await page.getByLabel("Username", { exact: true }).fill("admin")
    await page.getByLabel("Password", { exact: true }).fill("synthetic-ci-configured-password")
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    await page.waitForURL(appURL("/"))
    // Test destinations are app-relative; product requests still use real URLs.
    const goto = page.goto.bind(page)
    page.goto = (url, options) => goto(url.startsWith("/") ? appPath(url) : url, options)
    const escapedRequests: string[] = []
    if (urlPrefix) {
      const checkURL = (value: string) => {
        const url = new URL(value)
        if (url.host === new URL(appOrigin).host && !url.pathname.startsWith(appPath("/"))) {
          escapedRequests.push(value)
        }
      }
      page.on("request", (request) => checkURL(request.url()))
      page.on("websocket", (socket) => checkURL(socket.url()))
    }
    await use(page)
    expect(escapedRequests, "App requests must stay inside URL_PREFIX").toEqual([])
  },
  scenario: async ({ page: _page }, use) => {
    await use(new ScenarioClient())
  },

  waitForTask: async ({ page: _page }, use) => {
    await use(async (taskId, states, opts) => {
      const timeout = opts?.timeout ?? 15_000
      const interval = opts?.interval ?? 500
      const deadline = Date.now() + timeout
      const query = `USE NS celery_insights DB main; SELECT state FROM task:⟨${taskId}⟩`

      while (Date.now() < deadline) {
        try {
          const res = await privateObservationQuery(query)
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

  waitForTaskVisible: async ({ page: _page }, use) => {
    await use(async (taskId, opts) => {
      const timeout = opts?.timeout ?? 15_000
      const interval = opts?.interval ?? 500
      const deadline = Date.now() + timeout
      const query = `USE NS celery_insights DB main; SELECT id, root_id, parent_id, children FROM task WHERE id = task:⟨${taskId}⟩ OR root_id = '${taskId}' OR parent_id = '${taskId}' OR '${taskId}' IN children`

      while (Date.now() < deadline) {
        try {
          const res = await privateObservationQuery(query)
          if (res.ok) {
            const data = (await res.json()) as SurrealTaskResult[]
            const resultCount = data?.[1]?.result?.length ?? 0
            if (resultCount > 0) return
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

export { expect }
