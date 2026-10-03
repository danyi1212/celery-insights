import { afterEach, expect, it, vi } from "vitest"
import { authenticatedFetch } from "./authenticated-fetch"

afterEach(() => vi.restoreAllMocks())
it("sends the custom mutation header without a session request", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"))
  await authenticatedFetch("/api/settings/clear", { method: "POST" })
  expect(fetchSpy).toHaveBeenCalledTimes(1)
  expect(new Headers(fetchSpy.mock.calls[0][1]?.headers).get("X-Celery-Insights-Request")).toBe("1")
  expect(fetchSpy.mock.calls[0][1]?.credentials).toBe("same-origin")
})
it("keeps GET requests simple and preserves caller headers", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"))
  await authenticatedFetch("/api/settings/info", { headers: { Accept: "application/json" } })
  const headers = new Headers(fetchSpy.mock.calls[0][1]?.headers)
  expect(headers.get("Accept")).toBe("application/json")
  expect(headers.has("X-Celery-Insights-Request")).toBe(false)
})
