import { render, screen } from "@test-utils"
import { TaskState } from "@/types/surreal-records"
import TaskStateBadge from "./task-state-badge"

const now = new Date("2026-10-06T12:00:00Z")

describe("TaskStateBadge", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })
  afterEach(() => vi.useRealTimers())

  it("shows the plain state for aggregates without execution evidence", () => {
    render(<TaskStateBadge state={TaskState.STARTED} />)
    expect(screen.getByText("STARTED")).toBeInTheDocument()
    expect(screen.queryByText(/unconfirmed/)).not.toBeInTheDocument()
    expect(screen.getByText("STARTED")).not.toHaveClass("text-status-warning")
  })

  it("annotates a started task with its execution observation", () => {
    const { rerender } = render(
      <TaskStateBadge
        state={TaskState.STARTED}
        execution={{ execution_active: true, execution_observed_at: now, last_updated: now }}
      />,
    )
    expect(screen.getByText("STARTED · Observed running")).not.toHaveClass("text-status-warning")

    rerender(<TaskStateBadge state={TaskState.STARTED} execution={{ last_updated: now }} />)
    expect(screen.getByText("STARTED · Execution unconfirmed")).toHaveClass("text-status-warning")
  })
})
