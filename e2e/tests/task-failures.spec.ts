import { test, expect } from "../fixtures/base"

test.describe("Task Failures", () => {
  test("always_fails shows RuntimeError", async ({ page, scenario, waitForTask }) => {
    const { task_id } = await scenario.triggerScenario("always_fails")
    await waitForTask(task_id, ["FAILURE"])

    await page.goto(`/tasks/${task_id}`)
    const runtimeErrorAlert = page
      .getByRole("alert")
      .filter({ hasText: /RuntimeError/i })
      .first()
    await expect(runtimeErrorAlert).toBeVisible({ timeout: 15_000 })
    await expect(runtimeErrorAlert).toContainText("This task always fails")
  })

  test("division_by_zero shows ZeroDivisionError", async ({ page, scenario, waitForTask }) => {
    const { task_id } = await scenario.triggerScenario("division_by_zero")
    await waitForTask(task_id, ["FAILURE"])

    await page.goto(`/tasks/${task_id}`)
    const errorAlert = page
      .getByRole("alert")
      .filter({ hasText: /ZeroDivisionError/i })
      .first()
    await expect(errorAlert).toBeVisible({ timeout: 15_000 })
  })

  test("deep_traceback shows ValueError", async ({ page, scenario, waitForTask }) => {
    const { task_id } = await scenario.triggerScenario("deep_traceback")
    await waitForTask(task_id, ["FAILURE"])

    await page.goto(`/tasks/${task_id}`)
    const errorAlert = page
      .getByRole("alert")
      .filter({ hasText: /ValueError/i })
      .first()
    await expect(errorAlert).toBeVisible({ timeout: 15_000 })
  })

  test("retry_backoff eventually fails with retry info", async ({ page, scenario, waitForTask }) => {
    const { task_id } = await scenario.triggerScenario("retry_backoff")
    await waitForTask(task_id, ["FAILURE"], { timeout: 30_000 })

    await page.goto(`/tasks/${task_id}`)
    const connectionErrorAlert = page
      .getByRole("alert")
      .filter({ hasText: /ConnectionError/i })
      .first()
    await expect(connectionErrorAlert).toBeVisible({ timeout: 15_000 })
  })
})
