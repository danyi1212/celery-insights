import { render, screen } from "app/test-utils"
import DurationByTypeChart from "./duration-by-type-chart"

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}))

describe("DurationByTypeChart", () => {
  it("shows loading spinner when isLoading is true", () => {
    render(<DurationByTypeChart data={[]} isLoading={true} />)
    expect(screen.getByText("Task Duration by Type")).toBeInTheDocument()
  })

  it("shows empty message when data is empty", () => {
    render(<DurationByTypeChart data={[]} isLoading={false} />)
    expect(screen.getByText("No runtime data in the selected time range")).toBeInTheDocument()
  })

  it("renders chart when data is present", () => {
    const data = [{ type: "app.tasks.add", avg_runtime: 1.5, min_runtime: 0.5, max_runtime: 3.0, count: 10 }]
    render(<DurationByTypeChart data={data} isLoading={false} />)
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument()
  })
})
