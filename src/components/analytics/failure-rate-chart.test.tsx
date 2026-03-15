import { render, screen } from "app/test-utils"
import FailureRateChart from "./failure-rate-chart"

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}))

describe("FailureRateChart", () => {
  it("shows loading spinner when isLoading is true", () => {
    render(<FailureRateChart data={[]} isLoading={true} />)
    expect(screen.getByText("Failure Rate")).toBeInTheDocument()
  })

  it("shows empty message when data is empty", () => {
    render(<FailureRateChart data={[]} isLoading={false} />)
    expect(screen.getByText("No success/failure data in the selected time range")).toBeInTheDocument()
  })

  it("renders chart when data is present", () => {
    const data = [{ bucket: "2025-01-01T12:00", success: 8, failure: 2, total: 10, failure_rate: 20 }]
    render(<FailureRateChart data={data} isLoading={false} />)
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument()
  })
})
