import { act, render, screen } from "@test-utils"
import type { SurrealWorker } from "@/types/surreal-records"
import WorkerDetailsCard from "./worker-details-card"

const hooks = vi.hoisted(() => ({ useWorker: vi.fn(), useWorkerStats: vi.fn() }))
vi.mock("@hooks/use-live-workers", () => ({ useWorker: hooks.useWorker }))
vi.mock("@hooks/worker/use-worker-inspect", () => ({ useWorkerStats: hooks.useWorkerStats }))

const worker: SurrealWorker = {
  id: "worker:test-worker",
  status: "online",
  last_updated: "2026-10-06T12:57:36Z",
}

describe("WorkerDetailsCard status", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-06T12:57:37Z"))
    hooks.useWorker.mockReturnValue({ worker })
    hooks.useWorkerStats.mockReturnValue({ stats: {}, isLoading: false, error: null })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("keeps an online worker online when no heartbeat expiry is stored", () => {
    const { rerender } = render(<WorkerDetailsCard workerId="test-worker" />)
    expect(screen.getByText("Online")).toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(0)

    act(() => vi.advanceTimersByTime(10_000))
    rerender(<WorkerDetailsCard workerId="test-worker" />)

    expect(screen.getByText("Online")).toBeInTheDocument()
    expect(screen.queryByText("Offline")).not.toBeInTheDocument()
    expect(screen.queryByText("Unresponsive")).not.toBeInTheDocument()
  })

  it("updates status when the stored worker status changes", () => {
    const { rerender } = render(<WorkerDetailsCard workerId="test-worker" />)
    expect(screen.getByText("Online")).toBeInTheDocument()

    expect(screen.getByText("Status:")).toHaveClass("text-primary")

    hooks.useWorker.mockReturnValue({ worker: { ...worker, status: "offline" } })
    rerender(<WorkerDetailsCard workerId="test-worker" />)
    expect(screen.getByText("Offline")).toBeInTheDocument()
    expect(screen.getByText("Status:")).toHaveClass("text-destructive")

    hooks.useWorker.mockReturnValue({ worker })
    rerender(<WorkerDetailsCard workerId="test-worker" />)
    expect(screen.getByText("Online")).toBeInTheDocument()
    expect(screen.getByText("Status:")).toHaveClass("text-primary")
  })

  it("does not infer offline status when no worker observation is available", () => {
    hooks.useWorker.mockReturnValue({ worker: null })
    render(<WorkerDetailsCard workerId="test-worker" />)

    expect(screen.getByText("Unknown")).toBeInTheDocument()
    expect(screen.queryByText("Offline")).not.toBeInTheDocument()
  })
})
