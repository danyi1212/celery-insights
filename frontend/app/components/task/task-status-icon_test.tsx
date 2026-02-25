import { render, screen, waitFor } from "@test-utils"
import userEvent from "@testing-library/user-event"
import { TaskState } from "@services/server"
import TaskStatusIcon from "./task-status-icon"

describe("TaskStatusIcon", () => {
    const stateExpectations: [TaskState, string, string][] = [
        [TaskState.PENDING, "text-muted-foreground", "Pending"],
        [TaskState.RECEIVED, "text-blue-500", "Received"],
        [TaskState.STARTED, "text-blue-500", "Started"],
        [TaskState.SUCCESS, "text-green-500", "Success"],
        [TaskState.FAILURE, "text-red-500", "Failure"],
        [TaskState.IGNORED, "text-red-500", "Ignored"],
        [TaskState.REJECTED, "text-red-500", "Rejected"],
        [TaskState.REVOKED, "text-yellow-500", "Revoked"],
        [TaskState.RETRY, "text-yellow-500", "Retry"],
    ]

    it.each(stateExpectations)("renders correct color class for %s", (state, expectedClass) => {
        const { container } = render(<TaskStatusIcon status={state} />)
        const svg = container.querySelector("svg")
        expect(svg?.getAttribute("class")).toContain(expectedClass)
    })

    it.each(stateExpectations)("shows correct tooltip text on hover for %s", async (state, _class, expectedTooltip) => {
        const user = userEvent.setup()
        const { container } = render(<TaskStatusIcon status={state} />)

        const trigger = container.querySelector("[data-slot='tooltip-trigger']")!
        await user.hover(trigger)

        await waitFor(() => {
            expect(screen.getByRole("tooltip")).toHaveTextContent(expectedTooltip)
        })
    })

    it("passes through className to wrapper span", () => {
        const { container } = render(<TaskStatusIcon status={TaskState.SUCCESS} className="custom-wrapper" />)
        const span = container.querySelector("span")
        expect(span?.className).toContain("custom-wrapper")
    })

    it("passes through iconClassName to the icon", () => {
        const { container } = render(<TaskStatusIcon status={TaskState.SUCCESS} iconClassName="custom-icon" />)
        const svg = container.querySelector("svg")
        expect(svg?.getAttribute("class")).toContain("custom-icon")
    })
})
