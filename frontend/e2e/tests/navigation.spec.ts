import { test, expect } from "../fixtures/base";

test.describe("Navigation", () => {
  test("sidebar links navigate between pages", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("app-connection-loading")).toBeHidden({
      timeout: 30_000,
    });
    await expect(
      page.getByRole("heading", { name: "Online Workers", exact: true }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Tasks Explorer" }).click();
    await expect(page).toHaveURL(/\/explorer/);

    await page.getByRole("link", { name: "Live Events" }).click();
    await expect(page).toHaveURL(/\/raw_events/);

    await page.getByRole("link", { name: "Documentation" }).click();
    await expect(page).toHaveURL(/\/documentation\/setup/);
    await expect(page.getByRole("heading", { name: "Quick Start" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to Dashboard" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Configuration" })).toBeVisible();

    await page.getByRole("link", { name: "Back to Dashboard" }).click();
    await expect(page).toHaveURL("/");

    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings/);

    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL("/");
  });

  test("unknown route shows 404", async ({ page }) => {
    await page.goto("/nonexistent-page-xyz");
    await expect(page.getByText("404 Not Found")).toBeVisible();
    await expect(page.getByText("Back Home")).toBeVisible();
  });

  test("deep-link to task detail page", async ({
    page,
    scenario,
    waitForTask,
    waitForTaskVisible,
  }) => {
    const { task_id } = await scenario.triggerScenario("noop");
    await waitForTask(task_id, ["SUCCESS"]);
    await waitForTaskVisible(task_id);

    await page.goto(`/tasks/${task_id}`);
    await expect(page.getByText(task_id.slice(0, 8))).toBeVisible();
  });
});
