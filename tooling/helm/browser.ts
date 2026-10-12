import { chromium, expect } from "../playwright"

const base = process.env.HELM_E2E_URL!
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await context.newPage()
  await page.goto(`${base}/tasks/${process.env.HELM_E2E_TASK}`)
  await expect(page.getByLabel("Username")).toBeVisible()
  await page.getByLabel("Username").fill("admin")
  await page.getByLabel("Password").fill("invalid-password")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page.getByText("Invalid username or password.", { exact: true })).toBeVisible()
  await page.getByLabel("Username").fill("admin")
  await page.getByLabel("Password").fill(process.env.HELM_E2E_PASSWORD!)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page.locator("#task-header")).toContainText(process.env.HELM_E2E_TASK!, { timeout: 30_000 })
  await expect(page.locator("#task-header")).toContainText("tasks.basic.add")
  await page.reload()
  await expect(page.locator("#task-header")).toContainText(process.env.HELM_E2E_TASK!)
  const cookies = (await context.cookies()).map(({ name, value }) => `${name}=${value}`).join("; ")
  for (const target of JSON.parse(process.env.HELM_E2E_REPLICAS ?? "[]") as string[]) {
    const response = await context.request.get(`${target}/tools/celery/api/auth/identity`, {
      headers: { Cookie: cookies },
    })
    expect(response.status()).toBe(200)
    expect((await response.json()).account_id).toBe("admin")
  }
  const logout = await page.evaluate(async (base) => {
    const response = await fetch(`${base}/api/auth/logout`, {
      method: "POST",
      headers: { "X-Celery-Insights-Request": "1" },
    })
    return response.status
  }, base)
  expect(logout).toBe(204)
  await page.goto(`${base}/tasks/${process.env.HELM_E2E_TASK}`)
  await expect(page.getByLabel("Username")).toBeVisible()
} finally {
  await browser.close()
}
