import { test, expect } from "../fixtures/base"

test.describe("Mobile navigation", () => {
  for (const path of ["/", "/documentation/setup"]) {
    test(`keeps bottom navigation and sign out reachable from ${path}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 500 })
      await page.goto(path)
      await page.getByRole("button", { name: "Toggle Sidebar", exact: true }).click()

      const sidebar = page.locator('[data-sidebar="sidebar"][data-mobile="true"]')
      const settings = sidebar.getByRole("link", { name: "Settings", exact: true })
      await sidebar.hover()
      await page.mouse.wheel(0, 1500)
      await expect(settings).toBeInViewport({ ratio: 1 })
      await expect(sidebar.getByRole("button", { name: "Sign out", exact: true })).toBeInViewport({ ratio: 1 })
      await settings.click()
      await expect(page).toHaveURL(/\/settings$/)
    })
  }
})
