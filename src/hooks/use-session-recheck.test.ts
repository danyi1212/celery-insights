import { afterEach, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useSessionRecheck } from "./use-session-recheck"

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})
it("detects expiry while the observation connection and sidebar are unavailable", async () => {
  vi.useFakeTimers()
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }))
  const navigate = vi.spyOn(window.location, "assign").mockImplementation(() => {})
  const hook = renderHook(() => useSessionRecheck(false))
  await vi.advanceTimersByTimeAsync(60000)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(navigate).toHaveBeenCalledWith(expect.stringContaining("reason=expired&returnTo="))
  hook.unmount()
  await vi.advanceTimersByTimeAsync(60000)
  expect(fetch).toHaveBeenCalledTimes(1)
})
it("leaves connected-session polling to the account footer", async () => {
  vi.useFakeTimers()
  const fetch = vi.spyOn(globalThis, "fetch")
  renderHook(() => useSessionRecheck(true))
  await vi.advanceTimersByTimeAsync(60000)
  expect(fetch).not.toHaveBeenCalled()
})
it("does not turn temporary network failures into logout", async () => {
  vi.useFakeTimers()
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"))
  const navigate = vi.spyOn(window.location, "assign").mockImplementation(() => {})
  renderHook(() => useSessionRecheck(false))
  await vi.advanceTimersByTimeAsync(60000)
  expect(navigate).not.toHaveBeenCalled()
})
