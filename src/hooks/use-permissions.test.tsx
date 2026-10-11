import { beforeEach, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import useSettingsStore from "@stores/use-settings-store"
import { usePermissions } from "./use-permissions"

beforeEach(() => useSettingsStore.setState({ demo: false }))
it("uses grants rather than names to distinguish viewer and operator capabilities", () => {
  const client = new QueryClient()
  client.setQueryData(["identity", "live"], {
    account_id: "admin-named-viewer",
    permissions: ["task.metadata.read", "cleanup.run"],
  })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => usePermissions(), { wrapper })
  expect(result.current.can("task.metadata.read")).toBe(true)
  expect(result.current.can("cleanup.run")).toBe(true)
  expect(result.current.can("backup.import")).toBe(false)
  expect(result.current.can("cleanup.run", "history.clear")).toBe(false)
})
it("does not expose controls before identity is loaded", () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}))
  const client = new QueryClient()
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => usePermissions(), { wrapper })
  expect(result.current.isLoading).toBe(true)
  expect(result.current.can("history.clear")).toBe(false)
  vi.restoreAllMocks()
})
it("allows embedded-demo capabilities without requesting identity", () => {
  useSettingsStore.setState({ demo: true })
  const fetch = vi.spyOn(globalThis, "fetch")
  const client = new QueryClient()
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => usePermissions(), { wrapper })
  expect(result.current.can("task.export")).toBe(true)
  expect(fetch).not.toHaveBeenCalled()
  vi.restoreAllMocks()
})
