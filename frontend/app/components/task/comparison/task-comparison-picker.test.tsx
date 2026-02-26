import { render, screen } from "@test-utils"
import userEvent from "@testing-library/user-event"
import { TaskState, type Task } from "@/types/surreal-records"
import TaskComparisonPicker from "./task-comparison-picker"

vi.mock("surrealdb", () => ({}))

const mockUseTaskCandidates = vi.fn()

vi.mock("@hooks/use-task-candidates", () => ({
    useTaskCandidates: (...args: unknown[]) => mockUseTaskCandidates(...args),
}))

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, to, ...props }: { children?: React.ReactNode; to: string; [key: string]: unknown }) => (
        <a href={to} {...props}>
            {children}
        </a>
    ),
    useNavigate: () => vi.fn(),
}))

const createCandidate = (id: string, type: string, state: TaskState = TaskState.SUCCESS): Task => ({
    id,
    type,
    state,
    sent_at: new Date("2024-01-01T00:00:00Z"),
    last_updated: new Date("2024-01-01T00:00:05Z"),
    children: [],
    worker: "worker1@host",
})

const candidates = [
    createCandidate("task-1", "app.tasks.add", TaskState.SUCCESS),
    createCandidate("task-2", "app.tasks.add", TaskState.FAILURE),
    createCandidate("task-3", "app.tasks.multiply", TaskState.SUCCESS),
]

describe("TaskComparisonPicker", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseTaskCandidates.mockReturnValue({ candidates, isLoading: false })
    })

    it("renders the compare tasks heading", () => {
        render(<TaskComparisonPicker onSelectLeft={vi.fn()} onSelectRight={vi.fn()} />)

        expect(screen.getByText("Compare Tasks")).toBeInTheDocument()
    })

    it("shows task candidates", () => {
        render(<TaskComparisonPicker onSelectLeft={vi.fn()} onSelectRight={vi.fn()} />)

        expect(screen.getByText("task-1")).toBeInTheDocument()
        expect(screen.getByText("task-2")).toBeInTheDocument()
        expect(screen.getByText("task-3")).toBeInTheDocument()
    })

    it("calls onSelectLeft when clicking a task with no selections", async () => {
        const user = userEvent.setup()
        const onSelectLeft = vi.fn()

        render(<TaskComparisonPicker onSelectLeft={onSelectLeft} onSelectRight={vi.fn()} />)

        await user.click(screen.getByText("task-1"))

        expect(onSelectLeft).toHaveBeenCalledWith("task-1")
    })

    it("calls onSelectRight when left is already selected", async () => {
        const user = userEvent.setup()
        const onSelectRight = vi.fn()

        render(<TaskComparisonPicker leftId="task-1" onSelectLeft={vi.fn()} onSelectRight={onSelectRight} />)

        await user.click(screen.getByText("task-2"))

        expect(onSelectRight).toHaveBeenCalledWith("task-2")
    })

    it("shows Compare button when both tasks are selected", () => {
        render(<TaskComparisonPicker leftId="task-1" rightId="task-2" onSelectLeft={vi.fn()} onSelectRight={vi.fn()} />)

        expect(screen.getByRole("link", { name: "Compare" })).toBeInTheDocument()
    })

    it("does not show Compare button when only one task is selected", () => {
        render(<TaskComparisonPicker leftId="task-1" onSelectLeft={vi.fn()} onSelectRight={vi.fn()} />)

        expect(screen.queryByRole("link", { name: "Compare" })).not.toBeInTheDocument()
    })

    it("filters candidates by search query", async () => {
        const user = userEvent.setup()

        render(<TaskComparisonPicker onSelectLeft={vi.fn()} onSelectRight={vi.fn()} />)

        const input = screen.getByPlaceholderText("Filter by ID, type, or state...")
        await user.type(input, "multiply")

        expect(screen.queryByText("task-1")).not.toBeInTheDocument()
        expect(screen.getByText("task-3")).toBeInTheDocument()
    })

    it("passes taskType to useTaskCandidates", () => {
        render(<TaskComparisonPicker taskType="app.tasks.add" onSelectLeft={vi.fn()} onSelectRight={vi.fn()} />)

        expect(mockUseTaskCandidates).toHaveBeenCalledWith("app.tasks.add")
    })

    it("shows task type badge when taskType is provided", () => {
        render(<TaskComparisonPicker taskType="app.tasks.add" onSelectLeft={vi.fn()} onSelectRight={vi.fn()} />)

        expect(screen.getByText("app.tasks.add")).toBeInTheDocument()
    })

    it("shows no tasks found when candidates list is empty", () => {
        mockUseTaskCandidates.mockReturnValue({ candidates: [], isLoading: false })

        render(<TaskComparisonPicker onSelectLeft={vi.fn()} onSelectRight={vi.fn()} />)

        expect(screen.getByText("No tasks found")).toBeInTheDocument()
    })

    it("shows loading skeletons when loading", () => {
        mockUseTaskCandidates.mockReturnValue({ candidates: [], isLoading: true })

        const { container } = render(<TaskComparisonPicker onSelectLeft={vi.fn()} onSelectRight={vi.fn()} />)

        expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0)
    })

    it("does not allow selecting an already-selected task", async () => {
        const user = userEvent.setup()
        const onSelectLeft = vi.fn()

        render(<TaskComparisonPicker leftId="task-1" onSelectLeft={onSelectLeft} onSelectRight={vi.fn()} />)

        // task-1 appears in both slot card and candidate list — click the candidate list button
        const task1Elements = screen.getAllByText("task-1")
        // The candidate list button is the second occurrence
        await user.click(task1Elements[task1Elements.length - 1])

        expect(onSelectLeft).not.toHaveBeenCalled()
    })

    it("shows Left/Right selection badges on selected candidate rows", () => {
        render(<TaskComparisonPicker leftId="task-1" rightId="task-2" onSelectLeft={vi.fn()} onSelectRight={vi.fn()} />)

        // The slot cards show "Left" and "Right" labels, plus badges on candidate rows
        // Verify multiple occurrences exist (slot card + candidate badge)
        expect(screen.getAllByText("Left").length).toBeGreaterThanOrEqual(2)
        expect(screen.getAllByText("Right").length).toBeGreaterThanOrEqual(1)
    })
})
