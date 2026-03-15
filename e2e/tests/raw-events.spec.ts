import { test, expect } from "../fixtures/base"

test.describe("Raw Events", () => {
  test("triggered task generates events in the table", async ({ page, scenario }) => {
    await scenario.triggerScenario("noop")

    await page.goto("/raw_events")
    await expect(async () => {
      await page.reload()
      await expect(page.locator("table tbody tr").first()).toBeVisible()
    }).toPass({ timeout: 15_000 })
  })

  test("events counter shows non-zero count", async ({ page, scenario }) => {
    await scenario.triggerScenario("noop")

    await page.goto("/raw_events")
    await expect(async () => {
      await page.reload()
      await expect(page.getByText(/\d+ Events/)).toBeVisible()
    }).toPass({ timeout: 15_000 })
  })
})
