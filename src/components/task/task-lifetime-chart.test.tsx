import { render, screen } from "@test-utils"
import { createTask } from "@test-fixtures"
import { TaskState } from "@/types/surreal-records"
import TaskLifetimeChart from "./task-lifetime-chart"

const MOCK_NOW = new Date("2025-06-15T12:00:00Z")

vi.mock("@hooks/use-now", () => ({
  useNow: () => MOCK_NOW,
}))

describe("TaskLifetimeChart", () => {
  it("shows empty message when task has no lifecycle data", () => {
    // A task with sent_at equal to now and no further timestamps produces empty phases
    const task = createTask({
      state: TaskState.PENDING,
      sent_at: MOCK_NOW,
      received_at: undefined,
      started_at: undefined,
      succeeded_at: undefined,
    })
    render(<TaskLifetimeChart task={task} />)
    expect(screen.getByText("No lifecycle data available")).toBeInTheDocument()
  })

  it("renders phase segments for a completed task", () => {
    const base = MOCK_NOW.getTime() - 10000
    const task = createTask({
      state: TaskState.SUCCESS,
      sent_at: new Date(base),
      received_at: new Date(base + 2000),
      started_at: new Date(base + 4000),
      succeeded_at: new Date(base + 10000),
      runtime: 6.0,
    })
    render(<TaskLifetimeChart task={task} />)

    // Should have exactly 3 phase buttons (queue, worker, running)
    const phaseButtons = screen.getAllByRole("button")
    expect(phaseButtons).toHaveLength(3)
  })

  it("shows live indicator for active (non-terminal) tasks", () => {
    const task = createTask({
      state: TaskState.STARTED,
      sent_at: new Date(MOCK_NOW.getTime() - 5000),
      received_at: new Date(MOCK_NOW.getTime() - 4000),
      started_at: new Date(MOCK_NOW.getTime() - 3000),
      succeeded_at: undefined,
    })
    render(<TaskLifetimeChart task={task} />)
    expect(screen.getByText("Live")).toBeInTheDocument()
  })

  it("does not show live indicator for terminal tasks", () => {
    const task = createTask({
      state: TaskState.SUCCESS,
      sent_at: new Date(MOCK_NOW.getTime() - 10000),
      received_at: new Date(MOCK_NOW.getTime() - 9000),
      started_at: new Date(MOCK_NOW.getTime() - 8000),
      succeeded_at: new Date(MOCK_NOW.getTime() - 5000),
    })
    render(<TaskLifetimeChart task={task} />)
    expect(screen.queryByText("Live")).not.toBeInTheDocument()
  })

  it("displays total duration in the header", () => {
    const task = createTask({
      state: TaskState.SUCCESS,
      sent_at: new Date(MOCK_NOW.getTime() - 5000),
      received_at: new Date(MOCK_NOW.getTime() - 4000),
      started_at: new Date(MOCK_NOW.getTime() - 3000),
      succeeded_at: MOCK_NOW,
    })
    render(<TaskLifetimeChart task={task} />)
    // Total duration should be displayed with "Total:" prefix
    expect(screen.getByText(/Total:/)).toBeInTheDocument()
  })

  it("renders legend items", () => {
    const task = createTask({
      state: TaskState.SUCCESS,
      sent_at: new Date(MOCK_NOW.getTime() - 5000),
      received_at: new Date(MOCK_NOW.getTime() - 4000),
      started_at: new Date(MOCK_NOW.getTime() - 3000),
      succeeded_at: MOCK_NOW,
    })
    render(<TaskLifetimeChart task={task} />)
    expect(screen.getByText("Waiting in Queue")).toBeInTheDocument()
    expect(screen.getByText("Waiting in Worker")).toBeInTheDocument()
    expect(screen.getByText("Running")).toBeInTheDocument()
  })

  it("hides legend when showLegend is false", () => {
    const task = createTask({
      state: TaskState.SUCCESS,
      sent_at: new Date(MOCK_NOW.getTime() - 5000),
      received_at: new Date(MOCK_NOW.getTime() - 4000),
      started_at: new Date(MOCK_NOW.getTime() - 3000),
      succeeded_at: MOCK_NOW,
    })
    render(<TaskLifetimeChart task={task} showLegend={false} />)
    expect(screen.queryByText("Waiting in Queue")).not.toBeInTheDocument()
  })
})
