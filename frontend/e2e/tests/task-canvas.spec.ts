import { test, expect } from "../fixtures/base"

test.describe("Task Canvas (Workflows)", () => {
    test("chain shows workflow nodes", async ({ page, scenario, waitForTaskVisible }) => {
        test.setTimeout(120_000)
        const { task_id } = await scenario.triggerScenario("chain")
        await waitForTaskVisible(task_id, { timeout: 90_000 })

        await page.goto(`/tasks/${task_id}`)
        await expect(page.locator("#workflow-chart")).toBeVisible()
        await expect(page.locator("#workflow-chart .react-flow__node").first()).toBeVisible({ timeout: 30_000 })
    })

    test("chord workflow completes with chart", async ({ page, scenario, waitForTask }) => {
        const { task_id } = await scenario.triggerScenario("chord")
        await waitForTask(task_id, ["SUCCESS"], { timeout: 30_000 })

        await page.goto(`/tasks/${task_id}`)
        await expect(page.locator("#workflow-chart")).toBeVisible()
    })

    test("link_error shows workflow chart on failure", async ({ page, scenario, waitForTask }) => {
        const { task_id } = await scenario.triggerScenario("link_error")
        await waitForTask(task_id, ["FAILURE", "SUCCESS"], { timeout: 30_000 })

        await page.goto(`/tasks/${task_id}`)
        await expect(page.locator("#workflow-chart")).toBeVisible()
    })
})
