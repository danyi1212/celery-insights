import { appOrigin, appPath, appURL, urlPrefix } from "../helpers/app-url"
import { test, expect } from "../fixtures/base"

test.describe("Public mount path", () => {
  test("config, health and static assets use the public prefix", async ({ request, page }) => {
    const config = await request.get(appURL("/api/config"))
    expect(config.status()).toBe(200)
    expect((await config.json()).observationPath).toBe(appPath("/api/observation/rpc"))
    expect((await request.get(appURL("/health"))).status()).toBe(200)
    const logo = await request.get(appURL("/LogoGreen.svg"))
    expect(logo.status()).toBe(200)
    expect(logo.headers()["content-type"]).toContain("image/svg+xml")

    await page.goto("/documentation/configuration")
    await expect(page.getByRole("heading", { name: "Configuration", exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole("heading", { name: "Configuration", exact: true })).toBeVisible()
    const favicon = await page.locator('link[rel="icon"]').evaluate((node: HTMLLinkElement) => node.href)
    expect(new URL(favicon).pathname).toBe(appPath("/LogoGreen.svg"))
  })

  test("live tasks arrive through the public websocket without reloading", async ({ page, scenario, waitForTask }) => {
    const sockets: string[] = []
    page.on("websocket", (socket) => sockets.push(socket.url()))
    await page.goto("/")
    await expect(page.getByTestId("header-connection-status").getByText("Connected", { exact: true })).toBeVisible()
    await expect(page.locator("#recent-tasks li").first()).toBeVisible()
    const { task_id } = await scenario.triggerScenario("noop")
    await waitForTask(task_id, ["SUCCESS"])
    const link = page.locator(`#recent-tasks a[href="${appPath(`/tasks/${task_id}`)}"]`).first()
    await expect(link).toBeVisible({ timeout: 15_000 })
    expect(sockets.some((url) => new URL(url).pathname === appPath("/api/observation/rpc"))).toBe(true)
    await link.click()
    await expect(page.locator("#task-header")).toContainText(task_id)
    await page.reload()
    await expect(page.locator("#task-header")).toContainText(task_id)
  })

  test("plain documentation links retain the mount path", async ({ page }) => {
    await page.goto("/documentation/setup")
    await page.getByRole("link", { name: "/documentation/configuration", exact: true }).click()
    await expect(page).toHaveURL(appURL("/documentation/configuration"))
    await expect(page.getByRole("heading", { name: "Configuration", exact: true })).toBeVisible()
  })

  test("settings API downloads work from the mount path", async ({ page }) => {
    await page.goto("/settings")
    await expect(page.getByTestId("header-connection-status").getByText("Connected", { exact: true })).toBeVisible()
    await page.getByRole("link", { name: "Link to Backups" }).click()
    expect(new URL(page.url()).pathname).toBe(appPath("/settings"))
    expect(new URL(page.url()).hash).toBe("#backups")
    const downloadPromise = page.waitForEvent("download")
    await page.getByRole("button", { name: "Export Backup", exact: true }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe("celery_insights_backup.json")
    expect(await download.failure()).toBeNull()
  })

  test("MCP exposes tools through the mount path and retains origin checks", async ({ request }) => {
    const session = await request.get(appURL("/api/auth/identity"))
    expect(session.status()).toBe(200)
    const headers = {
      Accept: "application/json, text/event-stream",
      Origin: appOrigin,
      "X-Celery-Insights-Request": "1",
    }
    const data = { jsonrpc: "2.0", id: 1, method: "tools/list" }
    const response = await request.post(appURL("/mcp"), { headers, data })
    expect(response.status()).toBe(200)
    const payload = await response.json()
    expect(payload.result.tools.map((tool: { name: string }) => tool.name).sort()).toEqual([
      "inspect_task",
      "inspect_worker",
      "inspect_workflow",
      "list_workers",
      "search_workflows",
    ])
    expect((await request.get(appURL("/mcp"))).status()).toBe(405)
    const denied = await request.post(appURL("/mcp"), {
      headers: { ...headers, Origin: "https://other.example" },
      data,
    })
    expect(denied.status()).toBe(403)
  })

  test("shared proxy leaves sibling paths alone and redirects the bare prefix", async ({ request }) => {
    test.skip(!urlPrefix, "Only applies to the shared reverse proxy deployment")
    const root = await request.get(`${appOrigin}/`)
    expect(await root.text()).toBe("Shared application root")
    for (const path of ["/api/config", "/mcp", "/assets/missing.js", `${appPath("")}-other/`]) {
      expect((await request.get(`${appOrigin}${path}`)).status()).toBe(404)
    }
    const redirect = await request.get(appURL("") + "?example=1", { maxRedirects: 0 })
    expect(redirect.status()).toBe(308)
    expect(new URL(redirect.headers().location, appOrigin).pathname).toBe(appPath("/"))
    expect(new URL(redirect.headers().location, appOrigin).search).toBe("?example=1")
  })
})
