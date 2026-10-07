import { render, screen } from "@test-utils"
import { TaskState } from "@/types/surreal-records"
import { createTask } from "@test-fixtures"
import TaskExecutionPanel from "./task-execution-panel"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children?: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const now = new Date("2026-10-06T12:00:00Z")

const startedTask = (overrides: Parameters<typeof createTask>[0]) =>
  createTask({
    state: TaskState.STARTED,
    sent_at: new Date(now.getTime() - 70_000),
    received_at: new Date(now.getTime() - 69_000),
    started_at: new Date(now.getTime() - 60_000),
    last_updated: new Date(now.getTime() - 60_000),
    succeeded_at: undefined,
    runtime: undefined,
    ...overrides,
  })

describe("TaskExecutionPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })
  afterEach(() => vi.useRealTimers())

  it("shows the frozen runtime when execution is unconfirmed", () => {
    render(
      <TaskExecutionPanel
        task={startedTask({
          started_at: new Date(now.getTime() - 200_000),
          last_updated: new Date(now.getTime() - 200_000),
          execution_active: true,
          execution_observed_at: new Date(now.getTime() - 150_000),
        })}
      />,
    )
    expect(screen.getByText("Runtime unconfirmed:").nextElementSibling).toHaveTextContent("50.0s")
  })

  it("shows a live runtime for observed execution", () => {
    render(<TaskExecutionPanel task={startedTask({ execution_active: true, execution_observed_at: now })} />)
    expect(screen.getByText("Runtime:").nextElementSibling).toHaveTextContent("1min, 0.0s")
  })
})
