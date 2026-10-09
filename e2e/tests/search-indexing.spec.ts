import { randomUUID } from "node:crypto"
import { test, expect } from "../fixtures/base"
import { appURL } from "../helpers/app-url"

test("exact kwargs matches agree across quick search, Explorer and CSV", async ({ page }) => {
  const key = `search_${randomUUID().replaceAll("-", "_")}`
  const rows = [
    { id: randomUUID(), type: "test.search.number", kwargs: JSON.stringify({ [key]: 1 }) },
    { id: randomUUID(), type: "test.search.ten", kwargs: JSON.stringify({ [key]: 10 }) },
    { id: randomUUID(), type: "test.search.string", kwargs: JSON.stringify({ [key]: "1" }) },
  ]
  const queryDatabase = async (sql: string) => {
    const response = await fetch(appURL("/surreal/sql"), {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Basic ${btoa("root:root")}` },
      body: `USE NS celery_insights DB main; ${sql}`,
    })
    expect(response.ok).toBe(true)
    const results = (await response.json()) as { status: string; result: unknown }[]
    for (const result of results) expect(result.status, JSON.stringify(result.result)).toBe("OK")
  }
  await queryDatabase(`FOR $row IN ${JSON.stringify(rows)} {
    CREATE type::record('task', $row.id) SET state = 'SUCCESS', workflow_id = $row.id,
      type = $row.type, kwargs = $row.kwargs, kwargs_search_source = 'json', last_updated = time::now();
  };`)
  try {
    await page.goto("/")
    await page.locator("#search-bar").click()
    await page.locator("#quick-access-input").fill(`${key}=1`)
    await expect(page.getByRole("option", { name: /test.search.number/ })).toBeVisible()
    await expect(page.getByRole("option", { name: /test.search.ten|test.search.string/ })).toHaveCount(0)

    await page.goto(`/explorer?query=${encodeURIComponent(`${key}=1`)}`)
    await expect(page.locator("table tbody")).toContainText(rows[0].id)
    await expect(page.locator("table tbody")).not.toContainText(rows[1].id)
    await expect(page.locator("table tbody")).not.toContainText(rows[2].id)
    // The download request uses the same query and range as the visible Explorer rows.
    const responsePromise = page.waitForResponse((response) => response.url() === appURL("/api/exports/csv"))
    await page.getByRole("button", { name: "Download data" }).click()
    await page.getByRole("menuitem", { name: "Download CSV" }).click()
    const response = await responsePromise
    expect(response.ok()).toBe(true)
    const csv = await response.text()
    expect(csv).toContain(rows[0].id)
    expect(csv).not.toContain(rows[1].id)
    expect(csv).not.toContain(rows[2].id)
  } finally {
    await queryDatabase(`FOR $row IN ${JSON.stringify(rows)} { DELETE type::record('task', $row.id); };`)
  }
})
