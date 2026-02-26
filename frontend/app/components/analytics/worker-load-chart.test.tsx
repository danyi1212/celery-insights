import { render, screen } from "app/test-utils"
import WorkerLoadChart from "./worker-load-chart"

vi.mock("recharts", () => ({
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
    Bar: () => null,
    Cell: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
}))

describe("WorkerLoadChart", () => {
    it("shows loading spinner when isLoading is true", () => {
        render(<WorkerLoadChart data={[]} isLoading={true} />)
        expect(screen.getByText("Worker Load")).toBeInTheDocument()
    })

    it("shows empty message when data is empty", () => {
        render(<WorkerLoadChart data={[]} isLoading={false} />)
        expect(screen.getByText("No worker data in the selected time range")).toBeInTheDocument()
    })

    it("renders chart when data is present", () => {
        const data = [
            { worker: "worker1@host", count: 15 },
            { worker: "worker2@host", count: 10 },
        ]
        render(<WorkerLoadChart data={data} isLoading={false} />)
        expect(screen.getByTestId("bar-chart")).toBeInTheDocument()
    })
})
