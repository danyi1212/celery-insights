import { render, screen } from "app/test-utils"
import ThroughputChart from "./throughput-chart"

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}))

describe("ThroughputChart", () => {
  it("shows loading spinner when isLoading is true", () => {
    render(<ThroughputChart data={[]} isLoading={true} />)
    expect(screen.getByText("Task Throughput")).toBeInTheDocument()
  })

  it("shows empty message when data is empty", () => {
    render(<ThroughputChart data={[]} isLoading={false} />)
    expect(screen.getByText("No task data in the selected time range")).toBeInTheDocument()
  })

  it("renders chart when data is present", () => {
    const data = [
      { bucket: "2025-01-01T12:00", count: 10 },
      { bucket: "2025-01-01T12:30", count: 15 },
    ]
    render(<ThroughputChart data={data} isLoading={false} />)
    expect(screen.getByTestId("area-chart")).toBeInTheDocument()
  })
})
