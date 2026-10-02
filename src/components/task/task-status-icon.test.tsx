import { render, screen, waitFor } from "@test-utils"
import userEvent from "@testing-library/user-event"
import { TaskState } from "@/types/surreal-records"
import TaskStatusIcon from "./task-status-icon"

describe("TaskStatusIcon", () => {
  const stateExpectations: [TaskState, string, string][] = [
    [TaskState.PENDING, "text-muted-foreground", "Pending"],
    [TaskState.RECEIVED, "text-status-info", "Received"],
    [TaskState.STARTED, "text-status-info", "Started"],
    [TaskState.SUCCESS, "text-status-success", "Success"],
    [TaskState.FAILURE, "text-status-danger", "Failure"],
    [TaskState.IGNORED, "text-status-danger", "Ignored"],
    [TaskState.REJECTED, "text-status-danger", "Rejected"],
    [TaskState.REVOKED, "text-status-warning", "Revoked"],
    [TaskState.RETRY, "text-status-warning", "Retry"],
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
