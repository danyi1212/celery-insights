import { render, screen } from "@test-utils"
import { fireEvent } from "@testing-library/react"
import ExplorerActivityChart from "./explorer-activity-chart"

const histogram = [
  { bucket: "2026-04-06T10:02:00.000Z", count: 3, state: "SUCCESS" },
  { bucket: "2026-04-06T10:16:00.000Z", count: 2, state: "FAILURE" },
]

describe("ExplorerActivityChart", () => {
  const renderChart = (onSelectRange: (selection: { start: string; end: string }) => void) =>
    render(
      <div style={{ width: 900, height: 260 }}>
        <ExplorerActivityChart
          data={histogram}
          isLoading={false}
          emptyLabel="No data"
          rangeStart="2026-04-06T10:00:00.000Z"
          rangeEnd="2026-04-06T11:00:00.000Z"
          onSelectRange={onSelectRange}
        />
      </div>,
    )

  it("selects a single bucket on click", async () => {
    const onSelectRange = vi.fn()

    renderChart(onSelectRange)

    const overlay = screen.getByTestId("activity-chart-overlay")
    vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 20,
      width: 750,
      height: 180,
      top: 20,
      right: 850,
      bottom: 200,
      left: 100,
      toJSON: () => ({}),
    })

    fireEvent.mouseDown(overlay, { clientX: 110 })
    fireEvent.mouseUp(overlay, { clientX: 110 })

    expect(onSelectRange).toHaveBeenCalledWith({
      start: "2026-04-06T10:00:00.000Z",
      end: "2026-04-06T10:04:00.000Z",
    })
  })

  it("selects a dragged bucket span", async () => {
    const onSelectRange = vi.fn()

    renderChart(onSelectRange)

    const overlay = screen.getByTestId("activity-chart-overlay")
    vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 20,
      width: 750,
      height: 180,
      top: 20,
      right: 850,
      bottom: 200,
      left: 100,
      toJSON: () => ({}),
    })

    fireEvent.mouseDown(overlay, { clientX: 151 })
    fireEvent.mouseMove(overlay, { clientX: 251 })
    fireEvent.mouseUp(overlay, { clientX: 251 })

    expect(onSelectRange).toHaveBeenCalledWith({
      start: "2026-04-06T10:04:00.000Z",
      end: "2026-04-06T10:16:00.000Z",
    })
  })
})
