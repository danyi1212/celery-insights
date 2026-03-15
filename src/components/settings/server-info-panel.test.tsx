import { screen, waitFor } from "@/test-utils"
import { act, render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { IngestionStatus } from "@components/surrealdb-provider"
import type { ConnectionStatus } from "surrealdb"
import useSettingsStore from "@stores/use-settings-store"
import { ServerInfoPanel } from "./server-info-panel"

const mockUseSurrealDB = vi.fn()

vi.mock("@components/surrealdb-provider", () => ({
  useSurrealDB: () => mockUseSurrealDB(),
}))

const diagnostics = {
  cpu_usage: [0.42, 0.3, 0.2] as [number, number, number],
  memory_usage: 1024,
  uptime: 3600,
  server_hostname: "localhost",
  server_port: 8556,
  server_version: "1.2.3",
  server_os: "Linux",
  server_name: "celery-insights",
  python_version: "3.13.0",
  task_count: 1500,
  worker_count: 3,
  event_count: 8000,
  timezone: "UTC",
  surrealdb: {
    endpoint: "ws://surreal.internal:8557/rpc",
    namespace: "ci",
    database: "main",
    topology: "embedded",
    storage: "memory",
    durability: "memory",
  },
  ingestion: {
    batch_interval_ms: 100,
    queue_size: 3,
    buffer_size: 2,
    dropped_events: 4,
    events_ingested_total: 1234,
    flushes_total: 56,
  },
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  Wrapper.displayName = "ServerInfoPanelTestWrapper"
  return Wrapper
}

function setConnection(status: ConnectionStatus, ingestionStatus: IngestionStatus) {
  mockUseSurrealDB.mockReturnValue({ db: {}, status, ingestionStatus, error: null })
}

describe("ServerInfoPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useSettingsStore.setState({ demo: false })
    setConnection("connected", "leader")
  })

  it("renders the runtime summary and database details", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => diagnostics,
    } as Response)

    render(<ServerInfoPanel />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText("1,500 tasks")).toBeInTheDocument()
    })
    expect(screen.getByText("Embedded")).toBeInTheDocument()
    expect(screen.getByText("Ephemeral (memory)")).toBeInTheDocument()
    expect(screen.getByText("8,000 events · 3 workers")).toBeInTheDocument()
  })

  it("shows advanced diagnostics when expanded", async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => diagnostics,
    } as Response)

    render(<ServerInfoPanel />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /more details/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /more details/i }))

    expect(screen.getByText("ws://surreal.internal:8557/rpc")).toBeInTheDocument()
    expect(screen.getByText("1234")).toBeInTheDocument()
    expect(screen.getByText("56")).toBeInTheDocument()
  })

  it("shows the error state when diagnostics fail", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response)

    render(<ServerInfoPanel />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText("Server info request failed: 500")).toBeInTheDocument()
    })
  })

  it("shows a demo-mode message without requesting live diagnostics", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    useSettingsStore.setState({ demo: true })

    render(<ServerInfoPanel />, { wrapper: createWrapper() })

    expect(screen.getByText("Live system details are turned off")).toBeInTheDocument()
    expect(screen.getByText(/sample data/i)).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("does not reuse a live-mode error after switching into demo mode", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response)

    const { rerender } = render(<ServerInfoPanel />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText("Server info request failed: 500")).toBeInTheDocument()
    })

    await act(async () => {
      useSettingsStore.setState({ demo: true })
      rerender(<ServerInfoPanel />)
    })

    await waitFor(() => {
      expect(screen.getByText("Live system details are turned off")).toBeInTheDocument()
    })
    expect(screen.queryByText("Server info request failed: 500")).not.toBeInTheDocument()
  })
})
