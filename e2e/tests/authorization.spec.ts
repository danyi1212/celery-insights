import { test, expect } from "../fixtures/base"
import { request as createRequest } from "../../tooling/playwright"
import { appURL, appOrigin } from "../helpers/app-url"
import { updatePolicyFixture, policyService, privateObservationQuery } from "../helpers/docker-compose"
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
        "GET /api/observation/rpc": ["task.metadata.read"],
        "POST /api/observation/rpc": ["task.metadata.read"],
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
      for (const path of ["/", "/settings", "/api/auth/identity", "/api/observation/rpc"])
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

  test("checks typed read payload actions independently while viewers receive metadata only", async ({
    scenario,
    waitForTask,
    browser,
  }) => {
    const { task_id } = await scenario.triggerScenario("noop")
    await waitForTask(task_id, ["SUCCESS"])
    const restricted = await policyContext()
    const reader = await createRequest.newContext({
      ignoreHTTPSErrors: true,
      httpCredentials: { username: "reader", password: "synthetic-reader-secret", origin: appOrigin, send: "always" },
    })
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      httpCredentials: { username: "reader", password: "synthetic-reader-secret" },
    })
    try {
      for (const action of ["task.metadata.read", "task.input.read", "task.result.read", "task.failure.read"]) {
        updatePolicyFixture({ deny_actions: [action] })
        expect(
          (
            await restricted.post(appURL("/api/observation/rpc"), { headers, data: { operation: "list", id: task_id } })
          ).status(),
        ).toBe(403)
      }
      updatePolicyFixture()
      const response = await reader.post(appURL("/api/observation/rpc"), {
        headers,
        data: { operation: "list", id: task_id },
      })
      expect(response.status()).toBe(200)
      const [[task]] = await response.json()
      expect(task.type).toBeTruthy()
      for (const field of ["args", "kwargs", "result", "exception", "traceback"]) expect(task).not.toHaveProperty(field)
      const page = await context.newPage()
      await page.goto(appURL(`/tasks/${task_id}`))
      await expect(page.getByTestId("header-connection-status").getByText("Connected", { exact: true })).toBeVisible()
      await expect(page.locator("main")).toContainText(task_id)
    } finally {
      await context.close()
      await reader.dispose()
      await restricted.dispose()
    }
  })

  test("filters rows and payloads consistently across typed reads, exports, metrics, MCP and the UI", async ({
    browser,
    request,
  }) => {
    const seed = await privateObservationQuery(`USE NS celery_insights DB main;
      UPSERT task:scope_visible SET type = 'scope.visible', state = 'SUCCESS', workflow_id = 'scope_hidden', parent_id = 'scope_hidden', children = ['scope_hidden'], worker = 'scope-worker', args = 'secret-input-marker', kwargs = 'secret-kwargs-marker', result = 'secret-result-marker', exception = 'secret-failure-marker', traceback = 'secret-traceback-marker', last_updated = time::now();
      UPSERT task:scope_hidden SET type = 'scope.hidden', state = 'SUCCESS', workflow_id = 'scope_hidden', result = 'hidden-row-marker', last_updated = time::now();
      UPSERT event:scope_visible SET task_id = 'scope_visible', event_type = 'task-succeeded', timestamp = time::now(), data = 'secret-event-marker';
      UPSERT event:scope_visible2 SET task_id = 'scope_visible', event_type = 'task-succeeded', timestamp = time::now(), data = 'secret-event-marker';
      UPSERT event:scope_hidden SET task_id = 'scope_hidden', event_type = 'task-succeeded', timestamp = time::now(), data = 'hidden-row-marker';
      UPSERT worker:scope_worker SET status = 'online', last_updated = time::now(), inspect = '{"private":"secret-worker-marker"}';`)
    expect(seed.ok).toBe(true)
    const full = await request.get(appURL("/api/settings/export"))
    expect(await full.text()).toContain("secret-result-marker")
    updatePolicyFixture({
      result: {
        allow: true,
        scope: {
          task_ids: ["scope_visible"],
          deny_fields: [
            "task.input.read",
            "task.result.read",
            "task.failure.read",
            "event.raw.read",
            "worker.inspect.read",
          ],
        },
      },
    })
    const restricted = await policyContext()
    const context = await browser.newContext({ ignoreHTTPSErrors: true, httpCredentials: policyCredentials })
    try {
      const read = async (data: Record<string, unknown>) => {
        const response = await restricted.post(appURL("/api/observation/rpc"), { headers, data })
        expect(response.status()).toBe(200)
        const text = await response.text()
        expect(text).not.toMatch(/secret-.*-marker|hidden-row-marker|scope_hidden/)
        return JSON.parse(text)
      }
      const rows = await read({ operation: "list" })
      expect(rows[0]).toHaveLength(1)
      expect(rows[0][0].children).toEqual([])
      expect(rows[0][0]).not.toHaveProperty("result")
      expect(await read({ operation: "list", id: "scope_hidden" })).toEqual([[]])
      const explorer = await read({ operation: "explorer" })
      expect(explorer[1]).toEqual([{ count: 1 }])
      for (const operation of [
        "search",
        "home",
        "analytics",
        "exceptions",
        "counts",
        "task-workflow",
        "events",
        "export",
      ])
        await read({ operation, taskId: operation === "task-workflow" ? "scope_visible" : undefined })
      expect((await read({ operation: "search", query: "secret-result-marker" }))[0]).toEqual([])
      expect((await read({ operation: "list", table: "workflow" }))[0]).toEqual([])
      await read({ operation: "list", table: "worker" })
      const backup = await restricted.get(appURL("/api/settings/export"))
      expect(backup.status()).toBe(200)
      expect(await backup.text()).not.toMatch(/secret-.*-marker|hidden-row-marker|scope_hidden/)
      const csv = await restricted.post(appURL("/api/exports/csv"), {
        headers,
        data: { kind: "explorer", mode: "tasks", from: "2000-01-01T00:00:00Z", to: "2100-01-01T00:00:00Z" },
      })
      expect(csv.status()).toBe(200)
      expect(await csv.text()).not.toMatch(/secret-.*-marker|hidden-row-marker|scope_hidden/)
      expect(await (await restricted.get(appURL("/metrics"))).text()).toContain("celery_tasks_total 1")
      for (const route of ["/api/settings/info", "/api/settings/debug-snapshot", "/metrics/system", "/surreal/rpc"])
        expect((await restricted.get(appURL(route))).status()).toBe(403)
      for (const route of [
        "/api/settings/clear",
        "/api/settings/cleanup",
        "/api/settings/import",
        "/api/settings/download-debug-bundle",
      ])
        expect((await restricted.post(appURL(route), { headers })).status()).toBe(403)
      for (const [name, args] of [
        ["inspect_task", { task_id: "scope_visible" }],
        ["inspect_task", { task_id: "scope_hidden" }],
        ["inspect_task", { task_id: "scope_visible", section: "output" }],
        ["search_workflows", {}],
        ["inspect_workflow", { workflow_id: "scope_hidden" }],
        ["list_workers", {}],
        ["inspect_worker", { hostname: "scope_worker" }],
      ] as const) {
        const response = await restricted.post(appURL("/mcp"), {
          headers: { ...headers, Accept: "application/json, text/event-stream" },
          data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
        })
        expect(response.status()).toBe(200)
        const text = await response.text()
        expect(text).not.toMatch(/secret-.*-marker|hidden-row-marker/)
        const body = JSON.parse(text)
        if (name.includes("workflow") || ("task_id" in args && args.task_id === "scope_hidden") || "section" in args)
          expect(body.result.isError).toBe(true)
        else expect(body.result.isError).not.toBe(true)
      }
      for (const data of [
        { operation: "list", sortField: "result" },
        { operation: "list", sql: "DELETE task" },
        { operation: "list", limit: 10001 },
      ])
        expect((await restricted.post(appURL("/api/observation/rpc"), { headers, data })).status()).toBe(422)
      // Cursor continuation belongs to both this account and this effective policy scope.
      updatePolicyFixture({ result: { allow: true, scope: { task_ids: ["scope_visible"] } } })
      const mcp = async (client: typeof restricted, args: Record<string, unknown>) =>
        (
          await (
            await client.post(appURL("/mcp"), {
              headers: { ...headers, Accept: "application/json, text/event-stream" },
              data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "inspect_task", arguments: args } },
            })
          ).json()
        ).result
      const first = await mcp(restricted, { task_id: "scope_visible", section: "history", limit: 1 })
      expect(first.isError).not.toBe(true)
      const cursor = first.structuredContent.page.next_cursor
      expect(cursor).toBeTruthy()
      expect((await mcp(request, { task_id: "scope_visible", cursor })).isError).toBe(true)
      updatePolicyFixture({
        result: { allow: true, scope: { task_ids: ["scope_visible"], task_types: ["scope.visible"] } },
      })
      expect((await mcp(restricted, { task_id: "scope_visible", cursor })).isError).toBe(true)
      updatePolicyFixture({
        result: {
          allow: true,
          scope: {
            task_ids: ["scope_visible"],
            deny_fields: [
              "task.input.read",
              "task.result.read",
              "task.failure.read",
              "event.raw.read",
              "worker.inspect.read",
            ],
          },
        },
      })
      const page = await context.newPage()
      await page.goto(appURL("/tasks/scope_visible"))
      await expect(page.getByTestId("header-connection-status").getByText("Connected", { exact: true })).toBeVisible()
      await expect(page.locator("main")).toContainText("scope.visible")
      expect(await page.content()).not.toMatch(/secret-.*-marker|hidden-row-marker|scope.hidden/)
      updatePolicyFixture({ result: { allow: true, scope: { task_ids: [], deny_fields: [] } } })
      await expect(page.locator("main")).not.toContainText("scope.visible", { timeout: 15000 })
    } finally {
      await context.close()
      await restricted.dispose()
      await privateObservationQuery(
        "USE NS celery_insights DB main; DELETE task:scope_visible; DELETE task:scope_hidden; DELETE event:scope_visible; DELETE event:scope_visible2; DELETE event:scope_hidden; DELETE worker:scope_worker;",
      )
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
          appURL("/api/observation/rpc").replace("https:", "wss:"),
        )
        if (outage) policyService("stop")
        else updatePolicyFixture({ deny_actions: ["task.metadata.read"] })
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
        for (const action of ["task.metadata.read"]) {
          updatePolicyFixture({ deny_actions: [action] })
          expect(
            (
              await restricted.get(appURL("/api/observation/rpc"), { headers: { ...headers, Upgrade: "websocket" } })
            ).status(),
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
      updatePolicyFixture({ deny_actions: ["task.metadata.read"] })
      await scenario.triggerScenario("noop")
      await closed
      await expect(page.getByTestId("header-connection-status").getByText("Connected", { exact: true })).toHaveCount(0)
    } finally {
      await context.close()
    }
  })
})
