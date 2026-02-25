import { test, expect } from "../fixtures/base"

test.describe("Worker Detail", () => {
    test("navigating to worker shows details", async ({ page }) => {
        await page.goto("/")
        await expect(page.getByText("Online Workers")).toBeVisible()

        // Click the first worker link
        const workerLink = page.getByRole("link", { name: "View", exact: true }).first()
        await expect(workerLink).toBeVisible()
        await workerLink.click()

        await expect(page).toHaveURL(/\/workers\//)
        await expect(page.locator("#worker-details")).toBeVisible()
        await expect(page.locator("#worker-details")).toContainText("Hostname")
    })

    test("worker page shows pool and registered tasks", async ({ page }) => {
        await page.goto("/")
        const workerLink = page.getByRole("link", { name: "View", exact: true }).first()
        await expect(workerLink).toBeVisible()
        await workerLink.click()

        await expect(page.locator("#worker-pool")).toBeVisible()
        await expect(page.locator("#registered-tasks")).toBeVisible()
        await expect(page.locator("#registered-tasks")).toContainText("tasks.basic")
    })

    test("unknown worker shows not-found message", async ({ page }) => {
        await page.goto("/workers/celery@nonexistent-worker-xyz")
        await expect(page.getByText("Could not find worker")).toBeVisible()
    })
})
