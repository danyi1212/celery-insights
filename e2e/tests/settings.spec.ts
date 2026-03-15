import { test, expect } from "../fixtures/base"

test.describe("Settings", () => {
  test("settings page is organized into the new sections", async ({ page }) => {
    await page.goto("/settings")

    await expect(page.getByRole("heading", { name: /manage your workspace and this instance/i })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Workspace", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "System status", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Cleanup", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Backups", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Danger zone", exact: true })).toBeVisible()
  })

  test("workspace preferences are visible and understandable", async ({ page }) => {
    await page.goto("/settings")

    await expect(page.getByText("Welcome banner", { exact: true })).toBeVisible()
    await expect(page.getByText("Demo mode", { exact: true })).toBeVisible()
    await expect(page.getByText("Live events limit", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: /reset local settings/i })).toBeVisible()
  })

  test("database runtime surfaces SurrealDB diagnostics and maintenance actions", async ({ page }) => {
    await page.goto("/settings")

    await expect(page.getByText("Namespace / DB", { exact: true })).toBeVisible()
    await expect(page.getByText("Engine", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: /more details/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /download diagnostics/i })).toBeVisible()

    await page.getByRole("button", { name: /more details/i }).click()

    await expect(page.getByText("SurrealDB endpoint", { exact: true })).toBeVisible()
    await expect(page.getByText("Queue size", { exact: true })).toBeVisible()
    await expect(page.getByText("Dropped events", { exact: true })).toBeVisible()
    await expect(page.getByText("Clear stored data")).toBeVisible()
  })

  test("diagnostics failure shows unavailable overview cards and a system error", async ({ page }) => {
    await page.route("**/api/settings/info", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "boom" }),
      })
    })

    await page.goto("/settings")

    await expect(page.getByText("Unavailable")).toHaveCount(2)
    await expect(page.getByText("System details could not be loaded.")).toBeVisible()
    await expect(page.getByText("Record counts could not be loaded.")).toBeVisible()
    await expect(page.getByText("Server info request failed: 500")).toBeVisible()
  })
})
