import type { Page } from "@playwright/test"
import { test, expect } from "../fixtures/base"

const quickSearchShortcut = process.platform === "darwin" ? "Meta+K" : "Control+K"

const openQuickSearchWithShortcut = async (page: Page) => {
    await expect(page.locator("#search-bar")).toBeVisible()

    await expect(async () => {
        await page.keyboard.press(quickSearchShortcut)
        await expect(page.locator("#quick-access-input")).toBeVisible()
    }).toPass({ timeout: 15_000 })
}

test.describe("Search", () => {
    test("search bar is visible in header", async ({ page }) => {
        await page.goto("/")
        await expect(page.locator("#search-bar")).toBeVisible()
    })

    test("quick search opens with keyboard shortcut", async ({ page }) => {
        await page.goto("/")

        await openQuickSearchWithShortcut(page)
        await expect(page.getByText("Pages", { exact: true })).toBeVisible()
    })

    test("quick search navigates to pages", async ({ page }) => {
        await page.goto("/")

        await openQuickSearchWithShortcut(page)
        const input = page.locator("#quick-access-input")
        await input.fill("settings")
        await input.press("Enter")

        await expect(page).toHaveURL(/\/settings$/)
        await expect(page.getByRole("heading", { name: "System status", exact: true })).toBeVisible()
    })

    test("searching for a task type shows results", async ({ page, scenario, waitForTask }) => {
        const { task_id } = await scenario.triggerScenario("noop")
        await waitForTask(task_id, ["SUCCESS"])

        await page.goto("/")
        await page.locator("#search-bar").click()
        const input = page.locator("#quick-access-input")
        await input.fill("noop")

        await expect(async () => {
            await expect(page.getByRole("option", { name: /tasks\.basic\.noop/i }).first()).toBeVisible()
        }).toPass({ timeout: 30_000 })
        await expect(page.getByText(/Workflow/i).first()).toBeVisible()
    })

    test("quick search opens a matching task on Enter", async ({ page, scenario, waitForTask, waitForTaskVisible }) => {
        const { task_id } = await scenario.triggerScenario("noop")
        await waitForTask(task_id, ["SUCCESS"])
        await waitForTaskVisible(task_id)

        await page.goto("/")
        await openQuickSearchWithShortcut(page)
        const input = page.locator("#quick-access-input")
        await input.fill(task_id)

        await expect(async () => {
            await expect(page.getByRole("option", { name: /tasks\.basic\.noop/i }).first()).toBeVisible()
        }).toPass({ timeout: 30_000 })

        await input.press("Enter")

        await expect(page).toHaveURL(new RegExp(`/tasks/${task_id}$`))
        await expect(page.locator("#task-header")).toContainText(task_id)
    })

    test("nonsense query shows no results message", async ({ page }) => {
        await page.goto("/")
        await page.locator("#search-bar").click()
        const input = page.locator("#quick-access-input")
        await input.fill("zzznonexistent999xyz")

        await expect(page.getByText("No matching pages, documentation, tasks, or workers.")).toBeVisible()
    })
})
