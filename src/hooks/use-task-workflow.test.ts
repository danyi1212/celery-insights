import { act, renderHook, waitFor } from "@testing-library/react"
import { useTaskWorkflow } from "./use-task-workflow"

const mockQuery = vi.fn()
const mockLiveOf = vi.fn()
const mockDb = { query: mockQuery, liveOf: mockLiveOf }
let emit: (message: { value: unknown }) => void = () => {}

vi.mock("@components/surrealdb-provider", () => ({
  useSurrealDB: () => ({ db: mockDb, status: "connected" }),
}))

const snapshotCalls = () => mockQuery.mock.calls.filter(([query]) => String(query).includes("LET $task")).length

describe("useTaskWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockQuery.mockImplementation(async (query: string) =>
      query.startsWith("LIVE")
        ? ["live-uuid"]
        : [null, null, { task: { id: "task:root", workflow_id: "root" }, workflow: null, members: [] }],
    )
    mockLiveOf.mockResolvedValue({
      subscribe: (callback: typeof emit) => {
        emit = callback
        return () => {}
      },
      kill: vi.fn().mockResolvedValue(undefined),
    })
  })
  afterEach(() => vi.useRealTimers())

  it("coalesces a burst of member notifications into one snapshot refresh", async () => {
    renderHook(() => useTaskWorkflow("root"))
    await waitFor(() => expect(mockLiveOf).toHaveBeenCalled())
    expect(snapshotCalls()).toBe(1)

    act(() => {
      for (let i = 0; i < 100; i++) emit({ value: { id: `task:member-${i}`, workflow_id: "root" } })
    })
    expect(snapshotCalls()).toBe(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(snapshotCalls()).toBe(2)
  })
})
