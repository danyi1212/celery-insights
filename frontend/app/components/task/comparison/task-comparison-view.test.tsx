import { render, screen } from "@test-utils"
import TaskComparisonView from "./task-comparison-view"

vi.mock("surrealdb", () => ({}))

const mockUseTask = vi.fn()

vi.mock("@hooks/use-live-tasks", () => ({
    useTask: (...args: unknown[]) => mockUseTask(...args),
}))

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, to, ...props }: { children?: React.ReactNode; to: string; [key: string]: unknown }) => (
        <a href={to} {...props}>
            {children}
        </a>
    ),
    useNavigate: () => vi.fn(),
}))

const leftSurrealTask = {
    id: "task:left-id",
    type: "app.tasks.add",
    state: "SUCCESS",
    sent_at: "2024-01-01T00:00:00Z",
    received_at: "2024-01-01T00:00:01Z",
    started_at: "2024-01-01T00:00:02Z",
    succeeded_at: "2024-01-01T00:00:05Z",
    runtime: 3.0,
    last_updated: "2024-01-01T00:00:05Z",
    args: "('arg1',)",
    kwargs: "{'key': 'value'}",
    retries: 0,
    children: [],
    worker: "worker1@host",
    result: "'result_a'",
}

const rightSurrealTask = {
    id: "task:right-id",
    type: "app.tasks.add",
    state: "FAILURE",
    sent_at: "2024-01-01T01:00:00Z",
    received_at: "2024-01-01T01:00:01Z",
    started_at: "2024-01-01T01:00:02Z",
    failed_at: "2024-01-01T01:00:04Z",
    runtime: 2.0,
    last_updated: "2024-01-01T01:00:04Z",
    args: "('arg2',)",
    kwargs: "{'key': 'other'}",
    retries: 1,
    children: [],
    worker: "worker2@host",
    exception: "ValueError('bad')",
    traceback: "Traceback...",
}

describe("TaskComparisonView", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("renders comparison when both tasks exist", () => {
        mockUseTask.mockImplementation((id: string) => ({
            task: id === "left-id" ? leftSurrealTask : rightSurrealTask,
            data: [id === "left-id" ? leftSurrealTask : rightSurrealTask],
            isLoading: false,
            error: null,
        }))

        render(
            <TaskComparisonView leftId="left-id" rightId="right-id" onChangeLeft={vi.fn()} onChangeRight={vi.fn()} />,
        )

        expect(screen.getByText("Task Comparison")).toBeInTheDocument()
        expect(screen.getByText("Metadata")).toBeInTheDocument()
        expect(screen.getByText("Arguments")).toBeInTheDocument()
        expect(screen.getByText("Lifetime")).toBeInTheDocument()
    })

    it("shows task not found when a task is missing", () => {
        mockUseTask.mockReturnValue({
            task: null,
            data: [],
            isLoading: false,
            error: null,
        })

        render(
            <TaskComparisonView
                leftId="missing-left"
                rightId="missing-right"
                onChangeLeft={vi.fn()}
                onChangeRight={vi.fn()}
            />,
        )

        expect(screen.getByText("Task not found")).toBeInTheDocument()
    })

    it("shows loading skeleton when tasks are loading", () => {
        mockUseTask.mockReturnValue({
            task: null,
            data: [],
            isLoading: true,
            error: null,
        })

        const { container } = render(
            <TaskComparisonView leftId="left-id" rightId="right-id" onChangeLeft={vi.fn()} onChangeRight={vi.fn()} />,
        )

        expect(container.querySelector("[data-slot='skeleton']")).not.toBeNull()
    })

    it("highlights different values between tasks", () => {
        mockUseTask.mockImplementation((id: string) => ({
            task: id === "left-id" ? leftSurrealTask : rightSurrealTask,
            data: [id === "left-id" ? leftSurrealTask : rightSurrealTask],
            isLoading: false,
            error: null,
        }))

        render(
            <TaskComparisonView leftId="left-id" rightId="right-id" onChangeLeft={vi.fn()} onChangeRight={vi.fn()} />,
        )

        const badges = screen.getAllByText("Different")
        expect(badges.length).toBeGreaterThan(0)
    })

    it("shows exception section when tasks have exceptions", () => {
        mockUseTask.mockImplementation((id: string) => ({
            task: id === "left-id" ? leftSurrealTask : rightSurrealTask,
            data: [id === "left-id" ? leftSurrealTask : rightSurrealTask],
            isLoading: false,
            error: null,
        }))

        render(
            <TaskComparisonView leftId="left-id" rightId="right-id" onChangeLeft={vi.fn()} onChangeRight={vi.fn()} />,
        )

        expect(screen.getByText("Exception")).toBeInTheDocument()
        expect(screen.getByText("Traceback")).toBeInTheDocument()
    })

    it("displays task type badge when taskType is provided", () => {
        mockUseTask.mockImplementation((id: string) => ({
            task: id === "left-id" ? leftSurrealTask : rightSurrealTask,
            data: [id === "left-id" ? leftSurrealTask : rightSurrealTask],
            isLoading: false,
            error: null,
        }))

        render(
            <TaskComparisonView
                leftId="left-id"
                rightId="right-id"
                onChangeLeft={vi.fn()}
                onChangeRight={vi.fn()}
                taskType="app.tasks.add"
            />,
        )

        expect(screen.getByText("Task Comparison")).toBeInTheDocument()
        const badges = screen.getAllByText("app.tasks.add")
        expect(badges.length).toBeGreaterThanOrEqual(1)
    })

    it("shows identical badge when args are the same", () => {
        const sameTask = {
            ...rightSurrealTask,
            args: leftSurrealTask.args,
            kwargs: leftSurrealTask.kwargs,
            result: leftSurrealTask.result,
            exception: undefined,
            traceback: undefined,
            state: "SUCCESS",
        }

        mockUseTask.mockImplementation((id: string) => ({
            task: id === "left-id" ? leftSurrealTask : sameTask,
            data: [id === "left-id" ? leftSurrealTask : sameTask],
            isLoading: false,
            error: null,
        }))

        render(
            <TaskComparisonView leftId="left-id" rightId="right-id" onChangeLeft={vi.fn()} onChangeRight={vi.fn()} />,
        )

        const identicalBadges = screen.getAllByText("Identical")
        expect(identicalBadges.length).toBeGreaterThan(0)
    })

    it("shows runtime difference between tasks", () => {
        mockUseTask.mockImplementation((id: string) => ({
            task: id === "left-id" ? leftSurrealTask : rightSurrealTask,
            data: [id === "left-id" ? leftSurrealTask : rightSurrealTask],
            isLoading: false,
            error: null,
        }))

        render(
            <TaskComparisonView leftId="left-id" rightId="right-id" onChangeLeft={vi.fn()} onChangeRight={vi.fn()} />,
        )

        expect(screen.getByText(/Left:/)).toBeInTheDocument()
        expect(screen.getByText(/Right:/)).toBeInTheDocument()
    })
})
