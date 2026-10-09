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

  it.each(["tasks", "workflows"] as const)("searches keyword arguments in %s", async (mode) => {
    renderHook(() => useExplorerData({ ...createState(), mode, query: "organization_id=1" }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(mockQuery).toHaveBeenCalledTimes(1))
    const [query, bindings] = mockQuery.mock.calls[0]
    expect(query).toContain("string::matches(kwargs ?? '', $kwargsPattern)")
    expect(bindings.kwargsPattern).toContain("organization_id")
    expect(
      query.startsWith(
        "LET $rangeWorkflows = (SELECT VALUE root_task_id FROM workflow WHERE last_updated >= <datetime>$from AND last_updated <= <datetime>$to);LET $searchWorkflows = array::distinct(SELECT VALUE workflow_id FROM task WHERE workflow_id IN $rangeWorkflows AND",
      ),
    ).toBe(mode === "workflows")
    expect(query.includes("root_task_id IN $searchWorkflows")).toBe(mode === "workflows")
  })

  it("searches workflows by plain text without scanning member tasks", async () => {
    renderHook(() => useExplorerData({ ...createState(), mode: "workflows", query: "sync" }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(mockQuery).toHaveBeenCalledTimes(1))
    const [query, bindings] = mockQuery.mock.calls[0]
    expect(query.startsWith("SELECT * FROM workflow WHERE")).toBe(true)
    expect(query).not.toContain("LET ")
    expect(query).not.toContain("$searchWorkflows")
    expect(query).toContain("string::contains(string::lowercase(root_task_type ?? ''), $query)")
    expect(bindings.query).toBe("sync")
  })

  it("skips the LET result slots when searching workflows", async () => {
    const workflow = { id: "workflow:one", root_task_id: "one", aggregate_state: "SUCCESS" }
    mockQuery.mockResolvedValue([null, null, [workflow], [{ count: 1 }], [], [], []])
    const { result } = renderHook(
      () => useExplorerData({ ...createState(), mode: "workflows", query: "organization_id=1" }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.total).toBe(1))
    expect(result.current.workflows).toEqual([workflow])
  })

  it("builds filter queries without duplicate WHERE clauses", async () => {
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
