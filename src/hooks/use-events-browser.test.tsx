import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { createDefaultTimeRange } from "@lib/time-range-utils"
import useSettingsStore from "@stores/use-settings-store"
import { useEventsBrowser, type EventsBrowserState } from "./use-events-browser"

const mockQuery = vi.fn()

vi.mock("@components/surrealdb-provider", () => ({
  useSurrealDB: () => ({ db: { query: mockQuery }, status: "connected" }),
}))

describe("demo events browser", () => {
  beforeEach(() => {
    useSettingsStore.setState({ demo: true })
    mockQuery.mockReset()
  })

  afterEach(() => {
    useSettingsStore.setState({ demo: false })
  })

  it("reads demo events and refreshes with the current filters and row limit", async () => {
    const event = { id: "event:1", event_type: "task-received", timestamp: new Date().toISOString() }
    mockQuery.mockResolvedValue([[event], [{ count: 1 }], [{ event_type: "task-received", count: 1 }], []])
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const initialProps: EventsBrowserState = {
      range: createDefaultTimeRange(),
      rangeKey: "1h",
      query: "",
      types: [],
      pageCount: 1,
    }
    const { result, rerender, unmount } = renderHook((state) => useEventsBrowser(state), { wrapper, initialProps })
    await waitFor(() => expect(result.current.events).toEqual([event]))
    expect(result.current.total).toBe(1)
    expect(result.current.eventTypes).toEqual({ "task-received": 1 })

    await result.current.refetch()
    expect(mockQuery).toHaveBeenCalledTimes(2)

    rerender({ ...initialProps, query: "DEMO", types: ["task-received"], pageCount: 2 })
    await waitFor(() =>
      expect(mockQuery).toHaveBeenLastCalledWith(
        expect.stringContaining("event_type IN $types"),
        expect.objectContaining({ query: "demo", types: ["task-received"], rowLimit: 200 }),
      ),
    )
    unmount()
    client.clear()
  })
})
