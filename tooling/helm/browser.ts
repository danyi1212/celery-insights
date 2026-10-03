import { chromium, expect } from "../playwright"

const base = process.env.HELM_E2E_URL!
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.goto(`${base}/tasks/${process.env.HELM_E2E_TASK}`)
  await expect(page.getByPlaceholder("Password")).toBeVisible()
  await page.getByPlaceholder("Password").fill("invalid-password")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page.getByText("Invalid password", { exact: true })).toBeVisible()
  await page.getByPlaceholder("Password").fill(process.env.HELM_E2E_PASSWORD!)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page.locator("#task-header")).toContainText(process.env.HELM_E2E_TASK!, { timeout: 30_000 })
  await expect(page.locator("#task-header")).toContainText("tasks.basic.add")
  await page.reload()
  await expect(page.locator("#task-header")).toContainText(process.env.HELM_E2E_TASK!)
} finally {
  await browser.close()
}
