import { screen, waitFor } from "@/test-utils"
import { render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import useSettingsStore from "@stores/use-settings-store"
import DangerZonePanel from "./danger-zone-panel"

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
    Wrapper.displayName = "DangerZonePanelTestWrapper"
    return Wrapper
}

describe("DangerZonePanel", () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        useSettingsStore.setState({ demo: false })
    })

    it("requires confirmation before clearing data", async () => {
        const user = userEvent.setup()
        const fetchSpy = vi.spyOn(globalThis, "fetch")
        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => diagnostics,
        } as Response)

        render(<DangerZonePanel />, { wrapper: createWrapper() })

        await waitFor(() => {
            expect(screen.getByText(/1,500 tasks, 8,000 events, and 3 workers/)).toBeInTheDocument()
        })

        await user.click(screen.getByRole("button", { name: /clear stored data/i }))

        expect(screen.getByText(/click again within 8 seconds/i)).toBeInTheDocument()
        expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it("clears data after the confirmation click", async () => {
        const user = userEvent.setup()
        const fetchSpy = vi.spyOn(globalThis, "fetch")
        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => diagnostics,
        } as Response)
        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => true,
        } as Response)
        fetchSpy.mockResolvedValue({
            ok: true,
            json: async () => diagnostics,
        } as Response)

        render(<DangerZonePanel />, { wrapper: createWrapper() })

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /clear stored data/i })).toBeInTheDocument()
        })

        await user.click(screen.getByRole("button", { name: /clear stored data/i }))
        await user.click(screen.getByRole("button", { name: /clear stored data/i }))

        await waitFor(() => {
            const clearCall = fetchSpy.mock.calls.find(
                (call) =>
                    call[0] === "/api/settings/clear" && typeof call[1] === "object" && call[1]?.method === "POST",
            )
            expect(clearCall).toBeDefined()
            expect(screen.getByText("Stored data cleared.")).toBeInTheDocument()
        })
    })
})
