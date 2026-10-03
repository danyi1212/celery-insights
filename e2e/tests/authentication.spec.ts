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
      for (const path of ["/surreal/rpc", "/api/config", "/api/settings/export", "/metrics"])
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
