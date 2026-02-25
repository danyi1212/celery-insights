import { test, expect } from "../fixtures/base"

test.describe("Task Detail", () => {
    test("shows task header with type and ID", async ({ page, scenario, waitForTask }) => {
        const { task_id } = await scenario.triggerScenario("add")
        await waitForTask(task_id, ["SUCCESS"])

        await page.goto(`/tasks/${task_id}`)
        await expect(page.getByText("tasks.basic.add")).toBeVisible()
        await expect(page.getByText(task_id.slice(0, 8))).toBeVisible()
    })

    test("workflow chart is visible", async ({ page, scenario, waitForTask }) => {
        const { task_id } = await scenario.triggerScenario("add")
        await waitForTask(task_id, ["SUCCESS"])

        await page.goto(`/tasks/${task_id}`)
        await expect(page.locator("#workflow-chart")).toBeVisible()
    })

    test("lifetime chart is visible", async ({ page, scenario, waitForTask }) => {
        const { task_id } = await scenario.triggerScenario("add")
        await waitForTask(task_id, ["SUCCESS"])

        await page.goto(`/tasks/${task_id}`)
        await expect(page.locator("#lifetime-chart")).toBeVisible()
    })

    test("task details grid is visible", async ({ page, scenario, waitForTask }) => {
        const { task_id } = await scenario.triggerScenario("add")
        await waitForTask(task_id, ["SUCCESS"])

        await page.goto(`/tasks/${task_id}`)
        await expect(page.locator("#task-details")).toBeVisible()
    })

    test("unknown task ID shows not-found message", async ({ page }) => {
        await page.goto("/tasks/00000000-0000-0000-0000-000000000000")
        await expect(page.getByText("Could not find this task")).toBeVisible()
    })
})
