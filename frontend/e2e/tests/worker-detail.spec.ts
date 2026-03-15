import { test, expect } from "../fixtures/base"

test.describe("Worker Detail", () => {
    test("navigating to worker shows details", async ({ page }) => {
        await page.goto("/")
        await expect(page.getByTestId("app-connection-loading")).toBeHidden({ timeout: 30_000 })
        await expect(page.getByRole("heading", { name: "Worker Context", exact: true })).toBeVisible()

        // Click the first worker link
        const workerLink = page.getByRole("link", { name: "View", exact: true }).first()
        await expect(async () => {
            await page.reload()
            await expect(workerLink).toBeVisible()
        }).toPass({ timeout: 30_000 })
        await workerLink.click()

        await expect(page).toHaveURL(/\/workers\//)
        await expect(page.locator("#worker-details")).toBeVisible()
        await expect(page.locator("#worker-details")).toContainText("Hostname")
    })

    test("worker page shows pool and registered tasks", async ({ page }) => {
        await page.goto("/")
        await expect(page.getByTestId("app-connection-loading")).toBeHidden({ timeout: 30_000 })
        const workerLink = page.getByRole("link", { name: "View", exact: true }).first()
        await expect(async () => {
            await page.reload()
            await expect(workerLink).toBeVisible()
        }).toPass({ timeout: 30_000 })
        await workerLink.click()

        await expect(page.locator("#worker-pool")).toBeVisible()
        await expect(page.locator("#registered-tasks")).toBeVisible()
        await expect(page.locator("#registered-tasks")).toContainText(
            /Registered Task Types|No registered tasks found|tasks\./,
        )
    })

    test("unknown worker shows not-found message", async ({ page }) => {
        await page.goto("/workers/celery@nonexistent-worker-xyz")
        await expect(page.getByTestId("app-connection-loading")).toBeHidden({ timeout: 30_000 })
        await expect(page.getByText("Could not find worker")).toBeVisible()
    })
})
