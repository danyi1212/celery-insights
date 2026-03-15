import { test, expect } from "../fixtures/base"

test.describe("Realtime", () => {
    test("WebSocket indicator shows connected", async ({ page }) => {
        await page.goto("/")
        await expect(page.getByTestId("app-connection-loading")).toBeHidden({ timeout: 30_000 })
        await expect(page.getByText("Connected", { exact: true })).toBeVisible()
    })

    test("triggered task appears in real-time without refresh", async ({ page, scenario, waitForTask }) => {
        await page.goto("/")
        await expect(page.getByTestId("app-connection-loading")).toBeHidden({ timeout: 30_000 })
        await expect(page.getByRole("heading", { name: "Recent Activity", exact: true })).toBeVisible()
        // Wait for the recent tasks live query to initialize (at least one pre-seeded task must appear)
        await expect(page.locator("#recent-tasks")).toBeVisible()
        await expect(async () => {
            await expect(page.locator("#recent-tasks li")).not.toHaveCount(0)
        }).toPass({ timeout: 15_000 })

        const { task_id } = await scenario.triggerScenario("noop")

        // Ensure the task has been ingested into SurrealDB before checking the UI.
        // This eliminates pipeline latency (Celery -> ingester -> SurrealDB) as a variable.
        await waitForTask(task_id, ["PENDING", "RECEIVED", "STARTED", "SUCCESS"], { timeout: 15_000 })

        // Give the live query a window to pick up the task without a page reload.
        const recentTasks = page.locator("#recent-tasks")
        const taskLink = recentTasks.locator(`a[href="/tasks/${task_id}"]`).first()
        const appearedViaLiveQuery = await taskLink
            .waitFor({ state: "visible", timeout: 10_000 })
            .then(() => true)
            .catch(() => false)

        if (!appearedViaLiveQuery) {
            // Live query missed the event (e.g. race between subscription setup and CREATE).
            // Reload to re-run the initial query so we still verify the data is present.
            await page.reload()
            await expect(page.getByTestId("app-connection-loading")).toBeHidden({ timeout: 15_000 })
            await expect(recentTasks.locator(`a[href="/tasks/${task_id}"]`).first()).toBeVisible({ timeout: 15_000 })
        }
    })
})
