import { test, expect } from "../fixtures/base"

test.describe("Dashboard", () => {
    test("shows online workers", async ({ page }) => {
        await page.goto("/")
        await expect(page.getByTestId("app-connection-loading")).toBeHidden({ timeout: 30_000 })
        await expect(page.getByRole("heading", { name: "Online Workers", exact: true })).toBeVisible()
        await expect(page.locator("#recent-tasks")).toBeVisible()
    })

    test("triggered task appears in recent tasks", async ({ page, scenario, waitForTask }) => {
        const { task_id } = await scenario.triggerScenario("add")
        await waitForTask(task_id, ["SUCCESS"])

        await page.goto("/")
        await expect(async () => {
            await page.reload()
            await expect(page.locator("#recent-tasks")).toContainText("tasks.basic.add")
        }).toPass({ timeout: 15_000 })
    })

    test("failed task appears in exceptions summary", async ({ page, scenario, waitForTask }) => {
        const { task_id } = await scenario.triggerScenario("always_fails")
        await waitForTask(task_id, ["FAILURE"])

        await page.goto("/")
        await expect(async () => {
            await page.reload()
            await expect(page.getByText("RuntimeError")).toBeVisible()
        }).toPass({ timeout: 15_000 })
    })

    test("clicking task navigates to detail page", async ({ page, scenario, waitForTask }) => {
        const { task_id } = await scenario.triggerScenario("add")
        await waitForTask(task_id, ["SUCCESS"])

        await page.goto("/")
        await expect(async () => {
            await page.reload()
            await expect(page.locator("#recent-tasks")).toContainText("tasks.basic.add")
        }).toPass({ timeout: 15_000 })

        await page.locator("#recent-tasks").getByText("tasks.basic.add").first().click()
        await expect(page).toHaveURL(/\/tasks\//)
    })
})
