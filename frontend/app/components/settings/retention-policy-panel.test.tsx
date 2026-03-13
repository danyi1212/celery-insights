import { screen, waitFor } from "@/test-utils"
import { render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@components/ui/tooltip"
import useSettingsStore from "@stores/use-settings-store"
import { RetentionPolicyPanel } from "./retention-policy-panel"

const mockRetentionInfo = {
    settings: {
        cleanup_interval_seconds: 60,
        task_max_count: 10000,
        task_retention_hours: null,
        dead_worker_retention_hours: 24,
    },
    counts: {
        tasks: 1500,
        events: 8000,
        workers: 3,
    },
}

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>{children}</TooltipProvider>
        </QueryClientProvider>
    )
    Wrapper.displayName = "TestQueryWrapper"
    return Wrapper
}

describe("RetentionPolicyPanel", () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        useSettingsStore.setState({ demo: false })
    })

    it("displays record counts after loading", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
            ok: true,
            json: async () => mockRetentionInfo,
        } as Response)

        render(<RetentionPolicyPanel />, { wrapper: createWrapper() })

        await waitFor(() => {
            expect(screen.getByText("1,500")).toBeInTheDocument()
        })
        expect(screen.getByText("8,000")).toBeInTheDocument()
        expect(screen.getByText("3")).toBeInTheDocument()
    })

    it("populates form fields from server settings", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
            ok: true,
            json: async () => mockRetentionInfo,
        } as Response)

        render(<RetentionPolicyPanel />, { wrapper: createWrapper() })

        await waitFor(() => {
            const maxCountInput = screen.getByDisplayValue("10000")
            expect(maxCountInput).toBeInTheDocument()
        })
        expect(screen.getByDisplayValue("24")).toBeInTheDocument()
        expect(screen.getByDisplayValue("60")).toBeInTheDocument()
    })

    it("shows empty value for null settings", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
            ok: true,
            json: async () => mockRetentionInfo,
        } as Response)

        render(<RetentionPolicyPanel />, { wrapper: createWrapper() })

        await waitFor(() => {
            expect(screen.getByDisplayValue("10000")).toBeInTheDocument()
        })
        // task_retention_hours is null, so its input should be empty
        // Both max count and retention hours have "unlimited" placeholder, use getAllByPlaceholderText
        const unlimitedInputs = screen.getAllByPlaceholderText("unlimited")
        // The second "unlimited" input is task_retention_hours which should be empty
        expect(unlimitedInputs[1]).toHaveValue(null)
    })

    it("enables save button when a field is changed", async () => {
        const user = userEvent.setup()
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
            ok: true,
            json: async () => mockRetentionInfo,
        } as Response)

        render(<RetentionPolicyPanel />, { wrapper: createWrapper() })

        await waitFor(() => {
            expect(screen.getByDisplayValue("10000")).toBeInTheDocument()
        })

        const saveButton = screen.getByRole("button", { name: /apply to running instance/i })
        expect(saveButton).toBeDisabled()

        const maxCountInput = screen.getByDisplayValue("10000")
        await user.clear(maxCountInput)
        await user.type(maxCountInput, "5000")

        expect(saveButton).toBeEnabled()
    })

    it("sends PUT request when save is clicked", async () => {
        const user = userEvent.setup()
        const fetchSpy = vi.spyOn(globalThis, "fetch")
        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => mockRetentionInfo,
        } as Response)

        render(<RetentionPolicyPanel />, { wrapper: createWrapper() })

        await waitFor(() => {
            expect(screen.getByDisplayValue("10000")).toBeInTheDocument()
        })

        const maxCountInput = screen.getByDisplayValue("10000")
        await user.clear(maxCountInput)
        await user.type(maxCountInput, "5000")

        // Mock the PUT and subsequent GET responses
        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                ...mockRetentionInfo,
                settings: { ...mockRetentionInfo.settings, task_max_count: 5000 },
            }),
        } as Response)
        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                ...mockRetentionInfo,
                settings: { ...mockRetentionInfo.settings, task_max_count: 5000 },
            }),
        } as Response)

        await user.click(screen.getByRole("button", { name: /apply to running instance/i }))

        await waitFor(() => {
            const putCall = fetchSpy.mock.calls.find((call) => typeof call[1] === "object" && call[1]?.method === "PUT")
            expect(putCall).toBeDefined()
            expect(putCall![0]).toBe("/api/settings/retention")
            const body = JSON.parse(putCall![1]!.body as string)
            expect(body.task_max_count).toBe(5000)
        })
    })

    it("shows status message after save", async () => {
        const user = userEvent.setup()
        const fetchSpy = vi.spyOn(globalThis, "fetch")
        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => mockRetentionInfo,
        } as Response)

        render(<RetentionPolicyPanel />, { wrapper: createWrapper() })

        await waitFor(() => {
            expect(screen.getByDisplayValue("10000")).toBeInTheDocument()
        })

        const maxCountInput = screen.getByDisplayValue("10000")
        await user.clear(maxCountInput)
        await user.type(maxCountInput, "5000")

        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => mockRetentionInfo,
        } as Response)
        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => mockRetentionInfo,
        } as Response)

        await user.click(screen.getByRole("button", { name: /apply to running instance/i }))

        await waitFor(() => {
            expect(screen.getByText("Applied to the running instance")).toBeInTheDocument()
        })
    })

    it("sends POST request when cleanup button is clicked", async () => {
        const user = userEvent.setup()
        const fetchSpy = vi.spyOn(globalThis, "fetch")
        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => mockRetentionInfo,
        } as Response)

        render(<RetentionPolicyPanel />, { wrapper: createWrapper() })

        await waitFor(() => {
            expect(screen.getByText("1,500")).toBeInTheDocument()
        })

        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true, counts: { tasks: 1400, events: 7500, workers: 3 } }),
        } as Response)
        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                ...mockRetentionInfo,
                counts: { tasks: 1400, events: 7500, workers: 3 },
            }),
        } as Response)

        await user.click(screen.getByRole("button", { name: /run cleanup now/i }))

        await waitFor(() => {
            const postCall = fetchSpy.mock.calls.find(
                (call) =>
                    call[0] === "/api/settings/cleanup" && typeof call[1] === "object" && call[1]?.method === "POST",
            )
            expect(postCall).toBeDefined()
        })
    })

    it("shows cleanup completed message", async () => {
        const user = userEvent.setup()
        const fetchSpy = vi.spyOn(globalThis, "fetch")
        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => mockRetentionInfo,
        } as Response)

        render(<RetentionPolicyPanel />, { wrapper: createWrapper() })

        await waitFor(() => {
            expect(screen.getByText("1,500")).toBeInTheDocument()
        })

        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true, counts: { tasks: 1400, events: 7500, workers: 3 } }),
        } as Response)
        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => mockRetentionInfo,
        } as Response)

        await user.click(screen.getByRole("button", { name: /run cleanup now/i }))

        await waitFor(() => {
            expect(screen.getByText("Cleanup completed")).toBeInTheDocument()
        })
    })

    it("renders panel title", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
            ok: true,
            json: async () => mockRetentionInfo,
        } as Response)

        render(<RetentionPolicyPanel />, { wrapper: createWrapper() })

        expect(screen.getByText("Cleanup rules")).toBeInTheDocument()
        expect(screen.getByText("Runtime only")).toBeInTheDocument()
    })

    it("shows a demo-mode message without loading retention settings", () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch")
        useSettingsStore.setState({ demo: true })

        render(<RetentionPolicyPanel />, { wrapper: createWrapper() })

        expect(screen.getByText("Cleanup controls are turned off")).toBeInTheDocument()
        expect(screen.getByText(/does not connect to a live instance/i)).toBeInTheDocument()
        expect(fetchSpy).not.toHaveBeenCalled()
    })
})
