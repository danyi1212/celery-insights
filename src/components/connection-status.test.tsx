import { act, render, screen } from "@test-utils"
import { ConnectionStatusIndicator, ReadOnlyBanner } from "./connection-status"
import type { IngestionStatus } from "./surrealdb-provider"
import type { ConnectionStatus } from "surrealdb"

const mockUseSurrealDB = vi.fn()
const mockUseSettingsStore = vi.fn()

vi.mock("@components/surrealdb-provider", () => ({
  useSurrealDB: () => mockUseSurrealDB(),
}))

vi.mock("@stores/use-settings-store", () => ({
  default: (selector: (state: { demo: boolean }) => boolean) => mockUseSettingsStore(selector),
}))

function setMockContext(
  status: ConnectionStatus,
  ingestionStatus: IngestionStatus,
  error: Error | null = null,
  appConfig: unknown = null,
) {
  mockUseSurrealDB.mockReturnValue({ db: {}, status, ingestionStatus, error, appConfig })
}

describe("ConnectionStatusIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockUseSettingsStore.mockImplementation((selector) => selector({ demo: false }))
  })

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers()
    })
    vi.useRealTimers()
  })

  it("shows connected state for the leader instance", () => {
    setMockContext("connected", "leader")
    render(<ConnectionStatusIndicator />)

    expect(screen.getByText("Connected")).toBeInTheDocument()
  })

  it("shows reconnecting state", () => {
    setMockContext("reconnecting", "leader")
    render(<ConnectionStatusIndicator />)

    expect(screen.getByText("Reconnecting")).toBeInTheDocument()
  })

  it("shows disconnected state", () => {
    setMockContext("disconnected", "leader")
    render(<ConnectionStatusIndicator />)

    expect(screen.getByText("Disconnected")).toBeInTheDocument()
  })

  it("shows connecting state", () => {
    setMockContext("connecting", "leader")
    render(<ConnectionStatusIndicator />)

    expect(screen.getByText("Connecting")).toBeInTheDocument()
  })

  it("shows standby when connected but not ingesting", () => {
    setMockContext("connected", "standby")
    render(<ConnectionStatusIndicator />)

    expect(screen.getByText("Standby")).toBeInTheDocument()
  })

  it("shows read-only when connected without live ingestion", () => {
    setMockContext("connected", "read-only")
    render(<ConnectionStatusIndicator />)

    expect(screen.getByText("Read-only")).toBeInTheDocument()
  })

  it("shows connected when ingestion is disabled", () => {
    setMockContext("connected", "disabled")
    render(<ConnectionStatusIndicator />)

    expect(screen.getByText("Connected")).toBeInTheDocument()
  })

  it("shows demo mode when demo data is enabled", () => {
    setMockContext("connected", "leader")
    mockUseSettingsStore.mockImplementation((selector) => selector({ demo: true }))
    render(<ConnectionStatusIndicator />)

    expect(screen.getByText("Demo mode")).toBeInTheDocument()
  })

  it("keeps the connection label when disconnected even if ingestion state is stale", () => {
    setMockContext("disconnected", "standby")
    render(<ConnectionStatusIndicator />)

    expect(screen.queryByText("Standby")).not.toBeInTheDocument()
    expect(screen.getByText("Disconnected")).toBeInTheDocument()
  })

  it("collapses plain connected state after a short delay", () => {
    setMockContext("connected", "leader")
    render(<ConnectionStatusIndicator />)

    const indicator = screen.getByTestId("header-connection-status")
    expect(indicator).toHaveAttribute("data-expanded", "true")

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(indicator).toHaveAttribute("data-expanded", "false")
  })

  it("keeps important states expanded", () => {
    setMockContext("disconnected", "leader")
    render(<ConnectionStatusIndicator />)

    const indicator = screen.getByTestId("header-connection-status")

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(indicator).toHaveAttribute("data-expanded", "true")
  })

  it("re-expands when the status changes", () => {
    setMockContext("connected", "leader")
    const { rerender } = render(<ConnectionStatusIndicator />)

    const indicator = screen.getByTestId("header-connection-status")
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(indicator).toHaveAttribute("data-expanded", "false")

    setMockContext("reconnecting", "leader")
    rerender(<ConnectionStatusIndicator />)

    expect(indicator).toHaveAttribute("data-expanded", "true")
    expect(screen.getByText("Reconnecting")).toBeInTheDocument()
  })
})

describe("ReadOnlyBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows banner when ingestion status is read-only", () => {
    setMockContext("connected", "read-only")
    render(<ReadOnlyBanner />)

    expect(screen.getByText(/Read-only mode/)).toBeInTheDocument()
    expect(screen.getByText(/no live ingestion/)).toBeInTheDocument()
  })

  it("does not show banner when ingestion status is leader", () => {
    setMockContext("connected", "leader")
    const { container } = render(<ReadOnlyBanner />)

    expect(container.firstChild).toBeNull()
  })

  it("does not show banner when ingestion status is standby", () => {
    setMockContext("connected", "standby")
    const { container } = render(<ReadOnlyBanner />)

    expect(container.firstChild).toBeNull()
  })

  it("does not show banner when ingestion status is disabled", () => {
    setMockContext("connected", "disabled")
    const { container } = render(<ReadOnlyBanner />)

    expect(container.firstChild).toBeNull()
  })

  it("shows snapshot banner when replay mode is active", () => {
    setMockContext("connected", "read-only", null, {
      debugSnapshot: { enabled: true, readOnly: true },
    })
    render(<ReadOnlyBanner />)

    expect(screen.getByText(/Snapshot replay mode/)).toBeInTheDocument()
  })
})
