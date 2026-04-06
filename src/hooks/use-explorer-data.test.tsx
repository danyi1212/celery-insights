import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { deserializeTimeRange } from "@lib/time-range-utils"
import { useExplorerData, type ExplorerQueryState } from "./use-explorer-data"

const mockQuery = vi.fn()
const mockDb = { query: mockQuery }

vi.mock("@components/surrealdb-provider", () => ({
  useSurrealDB: () => ({
    db: mockDb,
    status: "connected",
    ingestionStatus: "leader",
    error: null,
  }),
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
        retry: false,
      },
    },
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const createState = (): ExplorerQueryState => ({
  mode: "tasks",
  range: deserializeTimeRange("1h", new Date("2026-04-06T10:04:00Z"))!,
  rangeKey: "1h",
  query: "",
  states: [],
  types: [],
  workers: [],
  workflowStates: [],
  rootTypes: [],
  sortField: "last_updated",
  sortDirection: "DESC",
  pageCount: 1,
})

describe("useExplorerData", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue([
      [],
      [{ count: 0 }],
      [],
      [],
      [],
      [{ bucket: "2026-04-06T10:00", state: "SUCCESS", count: 1 }],
    ])
  })

  it("builds facet queries without duplicate WHERE clauses", async () => {
    renderHook(() => useExplorerData(createState()), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledTimes(1)
    })

    const queryString = mockQuery.mock.calls[0][0] as string

    expect(queryString).toContain("SELECT type, count() AS count FROM task WHERE")
    expect(queryString).toContain("AND type != NONE GROUP BY type")
    expect(queryString).not.toContain("WHERE type != NONE GROUP BY type")
    expect(queryString).toContain("SELECT worker, count() AS count FROM task WHERE")
    expect(queryString).toContain("AND worker != NONE GROUP BY worker")
    expect(queryString).not.toContain("WHERE worker != NONE GROUP BY worker")
  })
})
