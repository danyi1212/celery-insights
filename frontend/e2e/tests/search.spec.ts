import { test, expect } from "../fixtures/base"

test.describe("Search", () => {
    test("search bar is visible in header", async ({ page }) => {
        await page.goto("/")
        await expect(page.locator("#search-bar")).toBeVisible()
    })

    test("searching for a task type shows results", async ({ page, scenario, waitForTask }) => {
        const { task_id } = await scenario.triggerScenario("noop")
        await waitForTask(task_id, ["SUCCESS"])

        await page.goto("/")
        const input = page.locator("#search-bar input")
        await input.click()
        await input.fill("noop")

        await expect(async () => {
            const resultLink = page.getByRole("link", { name: /tasks\.basic\.noop/i }).first()
            await expect(resultLink).toBeVisible()
        }).toPass({ timeout: 30_000 })
    })

    test("nonsense query shows no results message", async ({ page }) => {
        await page.goto("/")
        const input = page.locator("#search-bar input")
        await input.click()
        await input.fill("zzznonexistent999xyz")

        await expect(page.getByText("no tasks or workers matching")).toBeVisible()
    })
})
