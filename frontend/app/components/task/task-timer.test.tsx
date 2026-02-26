import { render, screen } from "@test-utils"
import { createStateTask } from "@test-fixtures"
import { TaskState } from "@/types/surreal-records"
import TaskTimer from "./task-timer"

vi.mock("@hooks/use-now", () => ({
    useNow: () => new Date("2025-06-15T12:00:00Z"),
}))

vi.mock("@components/common/distance-timer", () => ({
    default: ({ time }: { time: Date }) => <span data-testid="distance-timer">{time.toISOString()}</span>,
}))

const getTimerWrapper = () => {
    const wrapper = screen.getByTestId("distance-timer").closest("span.inline-flex")
    expect(wrapper).not.toBeNull()
    return wrapper!
}

describe("TaskTimer", () => {
    it("returns null when task has no eta or expires", () => {
        const task = createStateTask({ eta: undefined, expires: undefined })
        const { container } = render(<TaskTimer task={task} />)
        expect(container.innerHTML).toBe("")
    })

    it("shows ETA countdown when eta is in the future", () => {
        const task = createStateTask({ eta: "2025-06-15T13:00:00Z", expires: undefined })
        render(<TaskTimer task={task} />)
        expect(screen.getByTestId("distance-timer")).toBeInTheDocument()
        expect(getTimerWrapper().className).toContain("text-secondary")
    })

    it("shows expiry warning when expires is in the future", () => {
        const task = createStateTask({ eta: undefined, expires: "2025-06-15T12:30:00Z" })
        render(<TaskTimer task={task} />)
        expect(screen.getByTestId("distance-timer")).toBeInTheDocument()
        expect(getTimerWrapper().className).toContain("text-yellow-500")
    })

    it("shows red warning when expires is less than 5 minutes away", () => {
        const task = createStateTask({ eta: undefined, expires: "2025-06-15T12:03:00Z" })
        render(<TaskTimer task={task} />)
        expect(getTimerWrapper().className).toContain("text-red-500")
    })

    it("shows expired state when expires is in the past", () => {
        const task = createStateTask({ eta: undefined, expires: "2025-06-15T11:00:00Z" })
        render(<TaskTimer task={task} />)
        expect(getTimerWrapper().className).toContain("text-yellow-500")
    })

    it("prioritizes ETA over expires when ETA is in the future", () => {
        const task = createStateTask({
            eta: "2025-06-15T13:00:00Z",
            expires: "2025-06-15T14:00:00Z",
            state: TaskState.PENDING,
        })
        render(<TaskTimer task={task} />)
        expect(getTimerWrapper().className).toContain("text-secondary")
    })
})
