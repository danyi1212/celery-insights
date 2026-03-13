import { test, expect } from "../fixtures/base"

test.describe("Settings", () => {
    test("settings controls are visible", async ({ page }) => {
        await page.goto("/settings")
        await expect(page.getByText("Theme:", { exact: true })).toBeVisible()
        await expect(page.getByText("Demo mode:", { exact: true })).toBeVisible()
        await expect(page.getByText("Show welcome banner:", { exact: true })).toBeVisible()
        await expect(page.getByText("Help:", { exact: true })).toBeVisible()
    })

    test("server info shows hostname and python version", async ({ page }) => {
        await page.goto("/settings")
        await expect(page.getByText("Hostname:", { exact: true })).toBeVisible()
        await expect(page.getByText("Python Version:", { exact: true })).toBeVisible()
    })

    test("debug bundle button is visible", async ({ page }) => {
        await page.goto("/settings")
        await expect(page.getByText("Download Debug Bundle")).toBeVisible()
    })
})
