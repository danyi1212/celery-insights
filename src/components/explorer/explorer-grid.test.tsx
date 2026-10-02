import { render, screen, within } from "@test-utils"
import userEvent from "@testing-library/user-event"
import { RecordId } from "surrealdb"
import type { SurrealTask } from "@/types/surreal-records"
import ExplorerGrid from "./explorer-grid"

vi.mock("@components/task/task-avatar", () => ({
  default: ({ taskId }: { taskId: string }) => <span>{taskId}</span>,
}))
vi.mock("@stores/use-explorer-config", () => ({
  useExplorerColumns: () => [
    { property: "type", label: "Type", columnWidth: 300 },
    { property: "state", label: "Status", columnWidth: 100 },
  ],
}))

const tasks: SurrealTask[] = [
  {
    id: new RecordId("task", "first"),
    type: "tasks.first",
    state: "SUCCESS",
    children: [],
    last_updated: "2026-10-02T00:00:00Z",
  },
  {
    id: new RecordId("task", "second"),
    type: "tasks.second",
    state: "FAILURE",
    children: [],
    last_updated: "2026-10-02T00:00:00Z",
  },
]
const props = {
  tasks,
  sort: { field: "last_updated", direction: "DESC" as const },
  setSort: vi.fn(),
  page: 1,
  setPage: vi.fn(),
  pageSize: 2,
  total: 4,
}

describe("ExplorerGrid", () => {
  it("renders cell values with Table 9 instance methods and preserves server row order", () => {
    render(<ExplorerGrid {...props} />)
    const rows = screen.getAllByRole("row").slice(1)
    expect(within(rows[0]!).getByText("tasks.first")).toBeInTheDocument()
    expect(within(rows[1]!).getByText("tasks.second")).toBeInTheDocument()
    expect(screen.getByText("SUCCESS")).toBeInTheDocument()
    expect(screen.getByText("FAILURE")).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Type" })).toHaveStyle({ width: "300px" })
  })

  it("delegates sorting and pagination to the server-backed parent", async () => {
    const user = userEvent.setup()
    const setSort = vi.fn()
    const setPage = vi.fn()
    render(<ExplorerGrid {...props} setSort={setSort} setPage={setPage} />)
    await user.click(screen.getByRole("columnheader", { name: "Type" }))
    expect(setSort).toHaveBeenCalledWith({ field: "type", direction: "DESC" })
    const buttons = screen.getAllByRole("button")
    expect(buttons[0]).toBeDisabled()
    await user.click(buttons[1]!)
    expect(setPage).toHaveBeenCalledWith(2)
  })

  it("renders the empty state and updates cells when live task data changes", () => {
    const { rerender } = render(<ExplorerGrid {...props} tasks={[]} />)
    expect(screen.getByText("No tasks found.")).toBeInTheDocument()
    rerender(<ExplorerGrid {...props} />)
    expect(screen.queryByText("No tasks found.")).not.toBeInTheDocument()
    expect(screen.getByText("tasks.first")).toBeInTheDocument()
  })
})
