import { test, expect } from "../fixtures/base"
import { appURL, appOrigin } from "../helpers/app-url"
import { request as createRequest } from "../../tooling/playwright"

test.describe("Authenticated API boundary", () => {
  test("denies payload access to a separately configured viewer", async () => {
    const reader = await createRequest.newContext({
      ignoreHTTPSErrors: true,
      httpCredentials: { username: "reader", password: "synthetic-reader-secret", origin: appOrigin, send: "always" },
    })
    try {
      expect((await reader.get(appURL("/api/auth/identity"))).status()).toBe(200)
      expect((await reader.get(appURL("/api/config"))).status()).toBe(200)
      for (const path of ["/surreal/rpc", "/api/settings/export", "/metrics"])
        expect((await reader.get(appURL(path))).status()).toBe(403)
    } finally {
      await reader.dispose()
    }
  })

  test("requires configured credentials and denies cross-site writes", async ({ request }) => {
    const anonymous = await createRequest.newContext({
      ignoreHTTPSErrors: true,
      storageState: { cookies: [], origins: [] },
      httpCredentials: [],
    })
    try {
      expect((await anonymous.get(appURL("/api/settings/info"))).status()).toBe(401)
      expect((await anonymous.get(appURL("/metrics"))).status()).toBe(401)
    } finally {
      await anonymous.dispose()
    }
    const session = await request.get(appURL("/api/auth/identity"))
    expect(session.status()).toBe(200)
    const missing = await request.post(appURL("/api/settings/clear"), { headers: { Origin: appOrigin } })
    expect(missing.status()).toBe(403)
    const foreign = await request.post(appURL("/api/settings/clear"), {
      headers: { Origin: "https://other.example", "X-Celery-Insights-Request": "1" },
    })
    expect(foreign.status()).toBe(403)
    expect((await request.get(appURL("/api/settings/retention"))).status()).toBe(200)
    for (const path of ["/surreal/sql", "/surreal/import", "/surreal/export", "/api/unregistered", "/ws"]) {
      expect((await request.get(appURL(path))).status()).toBe(403)
    }
  })
})

test.describe("Browser login", () => {
  test("signs in through the form, preserves the destination and signs out", async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const page = await context.newPage()
    try {
      await page.goto(appURL("/settings"))
      await expect(page.getByRole("heading", { name: "Celery Insights" })).toBeVisible()
      await expect(page).toHaveURL(/\/login\?returnTo=/)
      await page.getByLabel("Username", { exact: true }).fill("admin")
      await page.getByLabel("Password", { exact: true }).fill("wrong-password")
      await page.getByRole("button", { name: "Sign in", exact: true }).click()
      await expect(page.getByRole("alert")).toHaveText("Invalid username or password.")
      await page.getByLabel("Username", { exact: true }).fill("admin")
      await page.getByLabel("Password", { exact: true }).fill("synthetic-ci-configured-password")
      await page.getByRole("button", { name: "Sign in", exact: true }).click()
      await expect(page).toHaveURL(appURL("/settings"))
      await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible()
      const identity = await context.request.get(appURL("/api/auth/identity"))
      expect(identity.status()).toBe(200)
      expect((await identity.json()).account_id).toBe("admin")
      const cookies = await context.cookies()
      expect(
        cookies.some((cookie) => cookie.httpOnly && cookie.secure && cookie.name.startsWith("__Secure-insights-")),
      ).toBe(true)
      await page.getByRole("button", { name: "Sign out", exact: true }).click()
      await expect(page).toHaveURL(appURL("/login"))
      expect((await context.request.get(appURL("/api/auth/identity"))).status()).toBe(401)
    } finally {
      await context.close()
    }
  })
})
