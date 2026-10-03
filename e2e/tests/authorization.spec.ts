import { test, expect } from "../fixtures/base"
import { request as createRequest } from "../../tooling/playwright"
import { appURL, appOrigin } from "../helpers/app-url"
import { updatePolicyFixture, policyService } from "../helpers/docker-compose"
import { routePermissions, payloadPermissions } from "../../runtime/security/permissions"

const headers = { Origin: appOrigin, "X-Celery-Insights-Request": "1" }
const policyCredentials = { username: "policy-admin", password: "synthetic-policy-secret" }

const policyContext = () =>
  createRequest.newContext({
    ignoreHTTPSErrors: true,
    httpCredentials: { ...policyCredentials, origin: appOrigin, send: "always" },
  })

test.describe("Restrictive OPA authorization", () => {
  test.afterEach(() => updatePolicyFixture())

  test("vetoes every permission at every registered API without executing writes", async ({
    request,
    scenario,
    waitForTask,
  }) => {
    test.setTimeout(90000)
    const restricted = await policyContext()
    try {
      const before = await (await request.get(appURL("/api/settings/retention"))).json()
      const { task_id } = await scenario.triggerScenario("noop")
      await waitForTask(task_id, ["SUCCESS"])
      const routes = {
        ...routePermissions,
        "GET /surreal/rpc": payloadPermissions,
        "POST /surreal/rpc": payloadPermissions,
        "POST /mcp": payloadPermissions,
      }
      // One blocked permission must deny an operation requiring several permissions.
      for (const [route, actions] of Object.entries(routes)) {
        const [method, path] = route.split(" ")
        for (const action of actions) {
          updatePolicyFixture({ deny_actions: [action] })
          const result = await restricted.fetch(appURL(path), { method, headers, data: {} })
          expect(result.status(), `${route}: ${action}`).toBe(403)
          expect(await result.text()).not.toContain("synthetic-policy-secret")
        }
      }
      expect((await (await request.get(appURL("/api/settings/retention"))).json()).settings).toEqual(before.settings)
      const backup = await request.get(appURL("/api/settings/export"))
      expect(backup.status()).toBe(200)
      expect(await backup.text()).toContain(task_id)
      updatePolicyFixture()
      expect((await restricted.get(appURL("/metrics"))).status()).toBe(200)
      expect((await restricted.get(appURL("/api/settings/export"))).status()).toBe(200)
      const identity = await restricted.get(appURL("/api/auth/identity"))
      expect(identity.status()).toBe(200)
      updatePolicyFixture({ deny_all: true })
      for (const path of ["/", "/settings", "/api/auth/identity", "/surreal/rpc"])
        expect((await restricted.get(appURL(path))).status()).toBe(403)
    } finally {
      await restricted.dispose()
    }
  })

  test("OPA allow cannot grant a viewer additional permissions", async () => {
    updatePolicyFixture({ result: true })
    const viewer = await createRequest.newContext({
      ignoreHTTPSErrors: true,
      httpCredentials: { username: "reader", password: "synthetic-reader-secret", origin: appOrigin, send: "always" },
    })
    try {
      expect((await viewer.get(appURL("/api/settings/retention"))).status()).toBe(200)
      for (const path of ["/metrics", "/api/settings/export", "/surreal/rpc"])
        expect((await viewer.get(appURL(path))).status()).toBe(403)
      expect((await viewer.post(appURL("/api/settings/clear"), { headers })).status()).toBe(403)
    } finally {
      await viewer.dispose()
    }
  })

  test("checks all five MCP tools independently of endpoint access", async () => {
    const restricted = await policyContext()
    try {
      const tools = {
        search_workflows: {},
        inspect_workflow: { workflow_id: "test" },
        inspect_task: { task_id: "test" },
        list_workers: {},
        inspect_worker: { hostname: "test" },
      }
      for (const [name, args] of Object.entries(tools)) {
        updatePolicyFixture({ deny_tools: [name] })
        const result = await restricted.post(appURL("/mcp"), {
          headers: { ...headers, Accept: "application/json, text/event-stream" },
          data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
        })
        expect(result.status()).toBe(200)
        const body = await result.json()
        expect(body.result.isError, name).toBe(true)
        expect(JSON.parse(body.result.content[0].text).code, name).toBe("access_denied")
      }
      updatePolicyFixture()
      const allowed = await restricted.post(appURL("/mcp"), {
        headers: { ...headers, Accept: "application/json, text/event-stream" },
        data: { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_workers", arguments: {} } },
      })
      expect((await allowed.json()).result.isError).not.toBe(true)
    } finally {
      await restricted.dispose()
    }
  })

  test("fails closed on invalid decisions and outage while probes remain available", async ({ request }) => {
    const restricted = await policyContext()
    try {
      updatePolicyFixture({ result: "true" })
      expect((await restricted.get(appURL("/metrics"))).status()).toBe(503)
      updatePolicyFixture()
      policyService("stop")
      try {
        expect((await restricted.get(appURL("/metrics"))).status()).toBe(503)
        expect((await restricted.post(appURL("/api/settings/clear"), { headers })).status()).toBe(503)
        expect((await request.get(appURL("/health"))).status()).toBe(200)
      } finally {
        policyService("start")
      }
      await expect.poll(async () => (await restricted.get(appURL("/metrics"))).status()).toBe(200)
    } finally {
      await restricted.dispose()
    }
  })

  for (const outage of [false, true]) {
    test(`closes an idle socket on its next client message after ${outage ? "OPA outage" : "revocation"}`, async ({
      browser,
      request,
    }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true, httpCredentials: policyCredentials })
      const page = await context.newPage()
      try {
        await page.goto(appURL("/documentation/configuration"))
        await page.evaluate(
          (url) =>
            new Promise<void>((resolve, reject) => {
              const socket = new WebSocket(url, "json")
              ;(window as Window & { policySocket?: WebSocket }).policySocket = socket
              socket.onopen = () => socket.send(JSON.stringify({ id: 1, method: "ping" }))
              socket.onmessage = () => {
                socket.onmessage = null
                resolve()
              }
              socket.onerror = () => reject(new Error("Fixture WebSocket failed"))
            }),
          appURL("/surreal/rpc").replace("https:", "wss:"),
        )
        if (outage) policyService("stop")
        else updatePolicyFixture({ deny_actions: ["task.input.read"] })
        const result = await page.evaluate(
          () =>
            new Promise<{ code: number; messages: number }>((resolve) => {
              const socket = (window as Window & { policySocket?: WebSocket }).policySocket!
              let messages = 0
              socket.onmessage = () => messages++
              socket.onclose = (event) => resolve({ code: event.code, messages })
              socket.send(JSON.stringify({ id: 2, method: "ping" }))
            }),
        )
        expect(result).toEqual({ code: 1008, messages: 0 })
      } finally {
        if (outage) {
          policyService("start")
          await expect.poll(async () => (await request.get(appURL("/metrics"))).status()).toBe(200)
        }
        await context.close()
      }
    })
  }

  test("rejects new live connections and revokes active delivery after a policy change", async ({
    browser,
    scenario,
  }) => {
    test.setTimeout(60000)
    const context = await browser.newContext({ ignoreHTTPSErrors: true, httpCredentials: policyCredentials })
    const page = await context.newPage()
    try {
      updatePolicyFixture({ deny_websocket: true })
      const restricted = await policyContext()
      try {
        for (const action of payloadPermissions) {
          updatePolicyFixture({ deny_actions: [action] })
          expect(
            (await restricted.get(appURL("/surreal/rpc"), { headers: { ...headers, Upgrade: "websocket" } })).status(),
            action,
          ).toBe(403)
        }
        updatePolicyFixture({ deny_websocket: true })
      } finally {
        await restricted.dispose()
      }
      await page.goto(appURL("/"))
      await expect(page.getByTestId("header-connection-status").getByText("Connected", { exact: true })).toHaveCount(0)
      updatePolicyFixture()
      await page.reload()
      await expect(page.getByTestId("header-connection-status").getByText("Connected", { exact: true })).toBeVisible()
      const socket = await page.evaluate(() => {
        // Delivery continues through the dashboard's existing live queries.
        return document.querySelector("#recent-tasks") !== null
      })
      expect(socket).toBe(true)
      const closed = page.waitForEvent("websocket").then((socket) => socket.waitForEvent("close"))
      // Reload establishes a socket that the harness can observe before revocation.
      await page.reload()
      await expect(page.getByTestId("header-connection-status").getByText("Connected", { exact: true })).toBeVisible()
      updatePolicyFixture({ deny_actions: ["task.input.read"] })
      await scenario.triggerScenario("noop")
      await closed
      await expect(page.getByTestId("header-connection-status").getByText("Connected", { exact: true })).toHaveCount(0)
    } finally {
      await context.close()
    }
  })
})
