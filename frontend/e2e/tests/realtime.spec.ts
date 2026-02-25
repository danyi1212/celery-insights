import { test, expect } from "../fixtures/base"

test.describe("Realtime", () => {
    test("WebSocket indicator shows connected", async ({ page }) => {
        await page.goto("/")
        await expect(page.getByText("Connected")).toBeVisible()
    })

    test("triggered task appears in real-time without refresh", async ({ page, scenario }) => {
        await page.goto("/")
        await expect(page.getByText("Online Workers")).toBeVisible()

        const { task_id } = await scenario.triggerScenario("noop")

        await expect(async () => {
            await expect(page.locator("#recent-tasks")).toContainText(task_id.slice(0, 8))
        }).toPass({ timeout: 15_000 })
    })
})
