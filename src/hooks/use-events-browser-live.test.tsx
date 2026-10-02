import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import useSettingsStore from "@stores/use-settings-store"
import { createDefaultTimeRange, createStaticTimeRange, serializeTimeRange } from "@lib/time-range-utils"
import { useEventsBrowser, type EventsBrowserState } from "./use-events-browser"

const mockQuery = vi.fn()
const mockDb = { query: mockQuery }

vi.mock("@components/surrealdb-provider", () => ({
  useSurrealDB: () => ({ db: mockDb, status: "connected", ingestionStatus: "disabled", error: null }),
}))

const createWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe("useEventsBrowser in demo mode", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    useSettingsStore.setState({ demo: true })
    mockQuery.mockResolvedValue([
      [{ id: "event:sample", event_type: "task-sent", timestamp: new Date().toISOString() }],
      [{ count: 1 }],
      [{ event_type: "task-sent", count: 1 }],
      [],
    ])
  })

  afterEach(() => {
    vi.useRealTimers()
    useSettingsStore.setState({ demo: false })
  })

  it("loads demo events, refreshes live ranges, and stops polling paused ranges", async () => {
    const range = createDefaultTimeRange()
    const state: EventsBrowserState = { range, rangeKey: serializeTimeRange(range), query: "", types: [], pageCount: 1 }
    const { result, rerender } = renderHook((state: EventsBrowserState) => useEventsBrowser(state), {
      initialProps: state,
      wrapper: createWrapper(),
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(result.current.events).toHaveLength(1)
    expect(mockQuery).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(mockQuery).toHaveBeenCalledTimes(2)

    const pausedRange = createStaticTimeRange(new Date(Date.now() - 3600000), new Date())!
    rerender({ ...state, range: pausedRange, rangeKey: serializeTimeRange(pausedRange) })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    const pausedQueryCount = mockQuery.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    expect(mockQuery).toHaveBeenCalledTimes(pausedQueryCount)
    expect(result.current.events).toHaveLength(1)
  })
})
