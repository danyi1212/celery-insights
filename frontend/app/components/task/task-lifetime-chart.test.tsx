import { render, screen } from "@test-utils"
import { createStateTask } from "@test-fixtures"
import { TaskState } from "@services/server"
import TaskLifetimeChart from "./task-lifetime-chart"

const MOCK_NOW = new Date("2025-06-15T12:00:00Z")

vi.mock("@hooks/use-now", () => ({
    useNow: () => MOCK_NOW,
}))

describe("TaskLifetimeChart", () => {
    it("shows empty message when task has no lifecycle data", () => {
        // A task with sentAt equal to now and no further timestamps produces empty phases
        const task = createStateTask({
            state: TaskState.PENDING,
            sentAt: MOCK_NOW,
            receivedAt: undefined,
            startedAt: undefined,
            succeededAt: undefined,
        })
        render(<TaskLifetimeChart task={task} />)
        expect(screen.getByText("No lifecycle data available")).toBeInTheDocument()
    })

    it("renders phase segments for a completed task", () => {
        const base = MOCK_NOW.getTime() - 10000
        const task = createStateTask({
            state: TaskState.SUCCESS,
            sentAt: new Date(base),
            receivedAt: new Date(base + 2000),
            startedAt: new Date(base + 4000),
            succeededAt: new Date(base + 10000),
            runtime: 6.0,
        })
        render(<TaskLifetimeChart task={task} />)

        // Should have exactly 3 phase buttons (queue, worker, running)
        const phaseButtons = screen.getAllByRole("button")
        expect(phaseButtons).toHaveLength(3)
    })

    it("shows live indicator for active (non-terminal) tasks", () => {
        const task = createStateTask({
            state: TaskState.STARTED,
            sentAt: new Date(MOCK_NOW.getTime() - 5000),
            receivedAt: new Date(MOCK_NOW.getTime() - 4000),
            startedAt: new Date(MOCK_NOW.getTime() - 3000),
            succeededAt: undefined,
        })
        render(<TaskLifetimeChart task={task} />)
        expect(screen.getByText("Live")).toBeInTheDocument()
    })

    it("does not show live indicator for terminal tasks", () => {
        const task = createStateTask({
            state: TaskState.SUCCESS,
            sentAt: new Date(MOCK_NOW.getTime() - 10000),
            receivedAt: new Date(MOCK_NOW.getTime() - 9000),
            startedAt: new Date(MOCK_NOW.getTime() - 8000),
            succeededAt: new Date(MOCK_NOW.getTime() - 5000),
        })
        render(<TaskLifetimeChart task={task} />)
        expect(screen.queryByText("Live")).not.toBeInTheDocument()
    })

    it("displays total duration in the header", () => {
        const task = createStateTask({
            state: TaskState.SUCCESS,
            sentAt: new Date(MOCK_NOW.getTime() - 5000),
            receivedAt: new Date(MOCK_NOW.getTime() - 4000),
            startedAt: new Date(MOCK_NOW.getTime() - 3000),
            succeededAt: MOCK_NOW,
        })
        render(<TaskLifetimeChart task={task} />)
        // Total duration should be displayed with "Total:" prefix
        expect(screen.getByText(/Total:/)).toBeInTheDocument()
    })

    it("renders legend items", () => {
        const task = createStateTask({
            state: TaskState.SUCCESS,
            sentAt: new Date(MOCK_NOW.getTime() - 5000),
            receivedAt: new Date(MOCK_NOW.getTime() - 4000),
            startedAt: new Date(MOCK_NOW.getTime() - 3000),
            succeededAt: MOCK_NOW,
        })
        render(<TaskLifetimeChart task={task} />)
        expect(screen.getByText("Waiting in Queue")).toBeInTheDocument()
        expect(screen.getByText("Waiting in Worker")).toBeInTheDocument()
        expect(screen.getByText("Running")).toBeInTheDocument()
    })

    it("hides legend when showLegend is false", () => {
        const task = createStateTask({
            state: TaskState.SUCCESS,
            sentAt: new Date(MOCK_NOW.getTime() - 5000),
            receivedAt: new Date(MOCK_NOW.getTime() - 4000),
            startedAt: new Date(MOCK_NOW.getTime() - 3000),
            succeededAt: MOCK_NOW,
        })
        render(<TaskLifetimeChart task={task} showLegend={false} />)
        expect(screen.queryByText("Waiting in Queue")).not.toBeInTheDocument()
    })
})
