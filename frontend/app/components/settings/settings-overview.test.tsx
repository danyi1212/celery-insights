import { screen, waitFor } from "@/test-utils"
import { render } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import useSettingsStore, { PreferredTheme, resetSettings } from "@stores/use-settings-store"
import SettingsOverview from "./settings-overview"

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
    Wrapper.displayName = "SettingsOverviewTestWrapper"
    return Wrapper
}

describe("SettingsOverview", () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        localStorage.clear()
        resetSettings()
        useSettingsStore.setState({
            theme: PreferredTheme.DARK,
            demo: false,
            hideWelcomeBanner: false,
            rawEventsLimit: 100,
        })
        mockUseSurrealDB.mockReturnValue({ db: {}, status: "connected", ingestionStatus: "disabled", error: null })
    })

    it("shows loading placeholders while diagnostics are being fetched", () => {
        vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => undefined))

        render(<SettingsOverview />, { wrapper: createWrapper() })

        expect(screen.getAllByText("Loading...")).toHaveLength(2)
        expect(screen.getByText("Checking the connected SurrealDB instance.")).toBeInTheDocument()
        expect(screen.getByText("Counting records in SurrealDB.")).toBeInTheDocument()
    })

    it("renders diagnostics when the request succeeds", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
            ok: true,
            json: async () => diagnostics,
        } as Response)

        render(<SettingsOverview />, { wrapper: createWrapper() })

        await waitFor(() => {
            expect(screen.getByText("Embedded")).toBeInTheDocument()
        })

        expect(screen.getByText("Dark")).toBeInTheDocument()
        expect(screen.getByText("1,500 tasks")).toBeInTheDocument()
        expect(screen.getByText("8,000 events · 3 workers")).toBeInTheDocument()
        expect(screen.getByText("Disabled · v1.2.3")).toBeInTheDocument()
    })

    it("shows unavailable states when diagnostics fail", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({}),
        } as Response)

        render(<SettingsOverview />, { wrapper: createWrapper() })

        await waitFor(() => {
            expect(screen.getAllByText("Unavailable")).toHaveLength(2)
        })

        expect(screen.getByText("System details could not be loaded.")).toBeInTheDocument()
        expect(screen.getByText("Record counts could not be loaded.")).toBeInTheDocument()
    })

    it("shows demo summaries without requesting live diagnostics", () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch")
        const queryMock = vi.fn().mockResolvedValue([[{ count: 17 }], [{ count: 134 }], [{ count: 2 }]])
        useSettingsStore.setState({ demo: true })
        mockUseSurrealDB.mockReturnValue({
            db: { query: queryMock },
            status: "connected",
            ingestionStatus: "disabled",
            error: null,
        })

        render(<SettingsOverview />, { wrapper: createWrapper() })

        expect(screen.getByText("Sample data")).toBeInTheDocument()
        expect(screen.getByText("Demo mode")).toBeInTheDocument()
        expect(screen.getAllByText("Demo")).toHaveLength(2)
        expect(fetchSpy).not.toHaveBeenCalled()
        return waitFor(() => {
            expect(screen.getByText("17 tasks")).toBeInTheDocument()
            expect(screen.getByText("134 events · 2 workers")).toBeInTheDocument()
        })
    })
})
