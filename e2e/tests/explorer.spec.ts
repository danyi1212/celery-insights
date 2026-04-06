import type { Page } from "@playwright/test"
import { test, expect } from "../fixtures/base"

const E2E_HOST = process.env.E2E_HOST ?? "127.0.0.1"
const SURREAL_API = `http://${E2E_HOST}:8555/surreal`

async function queryRecentTaskCount(): Promise<number> {
  const response = await fetch(`${SURREAL_API}/sql`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: "Basic " + Buffer.from("root:root").toString("base64"),
    },
    body:
      "USE NS celery_insights DB main;" +
      "SELECT count() AS count FROM task WHERE last_updated >= time::now() - <duration>'24h' GROUP ALL;",
  })

  const payload = (await response.json()) as Array<{ result?: Array<{ count?: number }> }>
  return payload?.[1]?.result?.[0]?.count ?? 0
}

async function queryRecentWorkflowCount(): Promise<number> {
  const response = await fetch(`${SURREAL_API}/sql`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: "Basic " + Buffer.from("root:root").toString("base64"),
    },
    body:
      "USE NS celery_insights DB main;" +
      "SELECT count() AS count FROM workflow WHERE last_updated >= time::now() - <duration>'24h' GROUP ALL;",
  })

  const payload = (await response.json()) as Array<{ result?: Array<{ count?: number }> }>
  return payload?.[1]?.result?.[0]?.count ?? 0
}

async function waitForExplorerRows(page: Page) {
  await expect(async () => {
    await expect(
      page
        .locator("table tbody tr")
        .filter({ has: page.getByRole("link") })
        .first(),
    ).toBeVisible()
  }).toPass({ timeout: 15_000 })
}

async function countExplorerRows(page: Page) {
  return page
    .locator("table tbody tr")
    .filter({ has: page.getByRole("link") })
    .count()
}

test.describe("Explorer", () => {
  test.beforeEach(async ({ scenario }) => {
    await scenario.triggerBurst(8)
  })

  test("explorer renders DB-backed task data instead of an empty state", async ({ page }) => {
    const dbTaskCount = await queryRecentTaskCount()
    expect(dbTaskCount).toBeGreaterThan(0)

    await page.goto("/explorer")
    await waitForExplorerRows(page)

    await expect(page.getByRole("button", { name: "Tasks view" })).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByRole("button", { name: "Workflows view" })).toHaveAttribute("aria-pressed", "false")
    await expect(page.getByText("No tasks found.")).toHaveCount(0)
    await expect(page.getByText("No tasks in the selected range")).toHaveCount(0)
    await expect(page.locator("#filters-panel li")).not.toHaveCount(0)
    await expect.poll(() => countExplorerRows(page)).toBeGreaterThan(0)
  })

  test("filtering updates the URL and keeps matching rows visible", async ({ page }) => {
    await page.goto("/explorer")
    await waitForExplorerRows(page)

    const initialRowCount = await countExplorerRows(page)
    const firstStatusOption = page
      .locator("#filters-panel")
      .getByRole("button")
      .filter({ hasText: /SUCCESS|FAILURE|STARTED|RECEIVED|PENDING|RETRY/ })
      .first()
    const selectedStatus = (await firstStatusOption.textContent())?.trim()

    expect(selectedStatus).toBeTruthy()
    await firstStatusOption.click()

    await expect(page).toHaveURL(/states=/)
    await waitForExplorerRows(page)

    const filteredRowCount = await countExplorerRows(page)
    expect(filteredRowCount).toBeGreaterThan(0)
    expect(filteredRowCount).toBeLessThanOrEqual(initialRowCount)
  })

  test("pausing the live range persists a canonical range param across reload", async ({ page }) => {
    await page.goto("/explorer")
    await waitForExplorerRows(page)

    await page.getByRole("button", { name: "Pause live range" }).click()

    await expect(page).toHaveURL(/range=v1:static:/)
    await page.reload()
    await waitForExplorerRows(page)
    await expect(page).toHaveURL(/range=v1:static:/)
    await expect(page.getByRole("button", { name: "Pause live range" })).toHaveCount(0)
  })

  test("clicking a chart bucket narrows the range to that bucket window", async ({ page }) => {
    await page.goto("/explorer")
    await waitForExplorerRows(page)

    await page.locator("[data-testid='activity-chart-overlay']").click({ position: { x: 8, y: 20 } })

    await expect(page).toHaveURL(/range=v1:static:/)
    await expect(page.getByRole("button", { name: "Pause live range" })).toHaveCount(0)
  })

  test("switching to workflow mode does not trigger the global error boundary", async ({
    page,
    scenario,
    waitForTaskVisible,
  }) => {
    const { task_id } = await scenario.triggerScenario("order_workflow")
    await waitForTaskVisible(task_id, { timeout: 30_000 })
    await expect.poll(queryRecentWorkflowCount, { timeout: 30_000 }).toBeGreaterThan(0)

    await page.goto("/explorer")
    await waitForExplorerRows(page)

    await page.getByRole("button", { name: "Workflows view" }).click()

    await expect(page.getByText(/^Error$/)).toHaveCount(0)
    await expect(page.getByText("Objects are not valid as a React child")).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Workflows view" })).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByRole("button", { name: "Tasks view" })).toHaveAttribute("aria-pressed", "false")
    await expect(
      page
        .locator("table tbody tr")
        .filter({ has: page.getByRole("link") })
        .first(),
    ).toBeVisible()
  })
})
