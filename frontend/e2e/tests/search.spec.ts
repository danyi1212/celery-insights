import { test, expect } from "../fixtures/base"

test.describe("Search", () => {
    test("search bar is visible in header", async ({ page }) => {
        await page.goto("/")
        await expect(page.locator("#search-bar")).toBeVisible()
    })

    test("quick search opens with keyboard shortcut", async ({ page }) => {
        await page.goto("/")

        await page.keyboard.press("Control+K")

        await expect(page.locator("#quick-access-input")).toBeVisible()
        await expect(page.getByText("Pages")).toBeVisible()
    })

    test("quick search navigates to pages", async ({ page }) => {
        await page.goto("/")

        await page.keyboard.press("Control+K")
        const input = page.locator("#quick-access-input")
        await input.fill("settings")
        await page.keyboard.press("Enter")

        await expect(page).toHaveURL(/\/settings$/)
        await expect(page.getByText("Server Info")).toBeVisible()
    })

    test("searching for a task type shows results", async ({ page, scenario, waitForTask }) => {
        const { task_id } = await scenario.triggerScenario("noop")
        await waitForTask(task_id, ["SUCCESS"])

        await page.goto("/")
        await page.locator("#search-bar").click()
        const input = page.locator("#quick-access-input")
        await input.fill("noop")

        await expect(async () => {
            await expect(page.getByText(/tasks\.basic\.noop/i).first()).toBeVisible()
        }).toPass({ timeout: 30_000 })
    })

    test("quick search opens a matching task on Enter", async ({ page, scenario, waitForTask, waitForTaskVisible }) => {
        const { task_id } = await scenario.triggerScenario("noop")
        await waitForTask(task_id, ["SUCCESS"])
        await waitForTaskVisible(task_id)

        await page.goto("/")
        await page.keyboard.press("Control+K")
        const input = page.locator("#quick-access-input")
        await input.fill("noop")

        await expect(async () => {
            await expect(page.getByText(/tasks\.basic\.noop/i).first()).toBeVisible()
        }).toPass({ timeout: 30_000 })

        await page.keyboard.press("Enter")

        await expect(page).toHaveURL(new RegExp(`/tasks/${task_id}$`))
        await expect(page.getByText(task_id.slice(0, 8))).toBeVisible()
    })

    test("nonsense query shows no results message", async ({ page }) => {
        await page.goto("/")
        await page.locator("#search-bar").click()
        const input = page.locator("#quick-access-input")
        await input.fill("zzznonexistent999xyz")

        await expect(page.getByText("No matching pages, tasks, or workers.")).toBeVisible()
    })
})
