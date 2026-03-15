import { test, expect } from "../fixtures/base"

test.describe("Explorer", () => {
  test("explorer table shows task rows", async ({ page, scenario }) => {
    await scenario.triggerBurst(5)
    await new Promise((r) => setTimeout(r, 5_000))
    await page.goto("/explorer")
    await expect(async () => {
      await expect(page.locator("table tbody tr").first()).toBeVisible()
    }).toPass({ timeout: 15_000 })
  })

  test("facets menu is visible with Status and Type", async ({ page }) => {
    await page.goto("/explorer")
    await expect(page.locator("#facets-menu")).toBeVisible()
    await expect(page.locator("#facets-menu")).toContainText("Status")
    await expect(page.locator("#facets-menu")).toContainText("Type")
  })

  test("tasks found count label is visible", async ({ page }) => {
    await page.goto("/explorer")
    await expect(async () => {
      await expect(page.getByText(/\d+ Tasks found/)).toBeVisible()
    }).toPass({ timeout: 15_000 })
  })
})
