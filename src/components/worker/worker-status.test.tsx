import { render, screen } from "@test-utils"
import WorkerStatus, { isWorkerOffline } from "./worker-status"

describe("WorkerStatus", () => {
  it("renders an online worker in the foreground color", () => {
    render(<WorkerStatus status="online" />)
    expect(screen.getByText("Online")).toHaveClass("text-foreground")
  })

  it("renders an offline worker in the destructive color", () => {
    render(<WorkerStatus status="offline" />)
    expect(screen.getByText("Offline")).toHaveClass("text-destructive")
  })

  it("renders any other stored value as Unknown in the warning color", () => {
    render(<WorkerStatus status="degraded" />)
    expect(screen.getByText("Unknown")).toHaveClass("text-status-warning")
  })

  it("renders a missing status as Unknown", () => {
    render(<WorkerStatus />)
    expect(screen.getByText("Unknown")).toHaveClass("text-status-warning")
  })

  it("only treats the stored offline value as offline", () => {
    expect(isWorkerOffline("offline")).toBe(true)
    expect(isWorkerOffline("online")).toBe(false)
    expect(isWorkerOffline("degraded")).toBe(false)
    expect(isWorkerOffline(undefined)).toBe(false)
  })
})
