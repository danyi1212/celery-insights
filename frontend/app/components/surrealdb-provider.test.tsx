import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import useSettingsStore from "@stores/use-settings-store"
import SurrealDBProvider, { useSurrealDB } from "./surrealdb-provider"

// Mock Surreal class
const mockSubscribe = vi.fn(() => vi.fn())
const mockConnect = vi.fn().mockResolvedValue(true)
const mockClose = vi.fn().mockResolvedValue(true)
const mockAuthenticate = vi.fn().mockResolvedValue(undefined)
const mockSignin = vi.fn().mockResolvedValue({ access: "test-token" })
const mockQuery = vi.fn().mockResolvedValue([])
const mockUse = vi.fn().mockResolvedValue(undefined)

vi.mock("surrealdb", () => {
    class MockSurreal {
        subscribe = mockSubscribe
        connect = mockConnect
        close = mockClose
        authenticate = mockAuthenticate
        signin = mockSignin
        query = mockQuery
        use = mockUse
        isConnected = false
        status = "disconnected"
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        constructor(options?: unknown) {}
    }
    return { Surreal: MockSurreal }
})

// Mock @surrealdb/wasm for demo mode
const mockCreateWasmEngines = vi.fn(() => ({
    "mem://": vi.fn(),
    "indxdb://": vi.fn(),
}))

vi.mock("@surrealdb/wasm", () => ({
    createWasmEngines: mockCreateWasmEngines,
}))

// Helper to test useSurrealDB hook
const ConsumerComponent = () => {
    const { status, ingestionStatus, error } = useSurrealDB()
    return (
        <div>
            <span data-testid="status">{status}</span>
            <span data-testid="ingestion">{ingestionStatus}</span>
            <span data-testid="error">{error?.message ?? "none"}</span>
        </div>
    )
}

describe("SurrealDBProvider — remote mode", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        sessionStorage.clear()
        // Ensure demo mode is off
        useSettingsStore.setState({ demo: false })
        // Default: anonymous config response
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(
                JSON.stringify({
                    authRequired: false,
                    surrealPath: "/surreal/rpc",
                    ingestionStatus: "leader",
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
            ),
        )
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("shows loading screen while fetching config", () => {
        // Use a pending promise to keep config loading forever
        vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}))

        render(
            <SurrealDBProvider>
                <ConsumerComponent />
            </SurrealDBProvider>,
        )

        expect(screen.getByText("Connecting...")).toBeInTheDocument()
    })

    it("connects anonymously when auth is not required", async () => {
        render(
            <SurrealDBProvider>
                <ConsumerComponent />
            </SurrealDBProvider>,
        )

        await waitFor(() => {
            expect(mockConnect).toHaveBeenCalledWith(
                expect.stringContaining("/surreal/rpc"),
                expect.objectContaining({ namespace: "celery_insights", database: "main" }),
            )
        })
    })

    it("provides context values to children", async () => {
        render(
            <SurrealDBProvider>
                <ConsumerComponent />
            </SurrealDBProvider>,
        )

        await waitFor(() => {
            expect(screen.getByTestId("ingestion")).toHaveTextContent("leader")
        })

        expect(screen.getByTestId("error")).toHaveTextContent("none")
    })

    it("shows login dialog when auth is required and no token exists", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(
                JSON.stringify({
                    authRequired: true,
                    surrealPath: "/surreal/rpc",
                    ingestionStatus: "leader",
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
            ),
        )

        render(
            <SurrealDBProvider>
                <ConsumerComponent />
            </SurrealDBProvider>,
        )

        await waitFor(() => {
            expect(screen.getByText("Celery Insights")).toBeInTheDocument()
            expect(screen.getByPlaceholderText("Password")).toBeInTheDocument()
        })
    })

    it("handles login submission", async () => {
        const user = userEvent.setup()

        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(
                JSON.stringify({
                    authRequired: true,
                    surrealPath: "/surreal/rpc",
                    ingestionStatus: "leader",
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
            ),
        )

        render(
            <SurrealDBProvider>
                <ConsumerComponent />
            </SurrealDBProvider>,
        )

        await waitFor(() => {
            expect(screen.getByPlaceholderText("Password")).toBeInTheDocument()
        })

        const input = screen.getByPlaceholderText("Password")
        await user.type(input, "secret")
        await user.click(screen.getByText("Sign in"))

        await waitFor(() => {
            expect(mockSignin).toHaveBeenCalledWith(
                expect.objectContaining({
                    access: "frontend",
                    variables: { name: "frontend", pass: "secret" },
                }),
            )
        })

        expect(sessionStorage.getItem("surrealdb_token")).toBe("test-token")
    })

    it("shows login error on failed signin", async () => {
        const user = userEvent.setup()
        mockSignin.mockRejectedValueOnce(new Error("Invalid credentials"))

        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(
                JSON.stringify({
                    authRequired: true,
                    surrealPath: "/surreal/rpc",
                    ingestionStatus: "leader",
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
            ),
        )

        render(
            <SurrealDBProvider>
                <ConsumerComponent />
            </SurrealDBProvider>,
        )

        await waitFor(() => {
            expect(screen.getByPlaceholderText("Password")).toBeInTheDocument()
        })

        const input = screen.getByPlaceholderText("Password")
        await user.type(input, "wrong")
        await user.click(screen.getByText("Sign in"))

        await waitFor(() => {
            expect(screen.getByText("Invalid password")).toBeInTheDocument()
        })
    })

    it("attempts to use existing session token when auth is required", async () => {
        sessionStorage.setItem("surrealdb_token", "existing-token")

        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(
                JSON.stringify({
                    authRequired: true,
                    surrealPath: "/surreal/rpc",
                    ingestionStatus: "standby",
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
            ),
        )

        render(
            <SurrealDBProvider>
                <ConsumerComponent />
            </SurrealDBProvider>,
        )

        await waitFor(() => {
            expect(mockAuthenticate).toHaveBeenCalledWith("existing-token")
        })
    })

    it("falls back to login dialog when existing token is invalid", async () => {
        sessionStorage.setItem("surrealdb_token", "expired-token")
        mockAuthenticate.mockRejectedValueOnce(new Error("Token expired"))

        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(
                JSON.stringify({
                    authRequired: true,
                    surrealPath: "/surreal/rpc",
                    ingestionStatus: "leader",
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
            ),
        )

        render(
            <SurrealDBProvider>
                <ConsumerComponent />
            </SurrealDBProvider>,
        )

        await waitFor(() => {
            expect(screen.getByPlaceholderText("Password")).toBeInTheDocument()
        })

        expect(sessionStorage.getItem("surrealdb_token")).toBeNull()
    })

    it("subscribes to connection status events", async () => {
        render(
            <SurrealDBProvider>
                <ConsumerComponent />
            </SurrealDBProvider>,
        )

        await waitFor(() => {
            expect(mockSubscribe).toHaveBeenCalledWith("connecting", expect.any(Function))
            expect(mockSubscribe).toHaveBeenCalledWith("connected", expect.any(Function))
            expect(mockSubscribe).toHaveBeenCalledWith("reconnecting", expect.any(Function))
            expect(mockSubscribe).toHaveBeenCalledWith("disconnected", expect.any(Function))
            expect(mockSubscribe).toHaveBeenCalledWith("error", expect.any(Function))
        })
    })

    it("closes connection on unmount", async () => {
        const { unmount } = render(
            <SurrealDBProvider>
                <ConsumerComponent />
            </SurrealDBProvider>,
        )

        await waitFor(() => {
            expect(screen.getByTestId("ingestion")).toHaveTextContent("leader")
        })

        unmount()
        expect(mockClose).toHaveBeenCalled()
    })
})

describe("SurrealDBProvider — demo mode", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        sessionStorage.clear()
        // Enable demo mode
        useSettingsStore.setState({ demo: true })
    })

    afterEach(() => {
        useSettingsStore.setState({ demo: false })
        vi.restoreAllMocks()
    })

    it("shows demo loading screen with progress stages", async () => {
        render(
            <SurrealDBProvider>
                <ConsumerComponent />
            </SurrealDBProvider>,
        )

        // Should show "Demo Mode" heading and a loading message
        expect(screen.getByText("Demo Mode")).toBeInTheDocument()
    })

    it("connects to mem:// embedded database (requires lazy-loaded WASM engine)", async () => {
        render(
            <SurrealDBProvider>
                <ConsumerComponent />
            </SurrealDBProvider>,
        )

        await waitFor(() => {
            expect(mockConnect).toHaveBeenCalledWith("mem://")
        })
    })

    it("sets up namespace and database in embedded mode", async () => {
        render(
            <SurrealDBProvider>
                <ConsumerComponent />
            </SurrealDBProvider>,
        )

        await waitFor(() => {
            expect(mockQuery).toHaveBeenCalledWith("DEFINE NAMESPACE IF NOT EXISTS celery_insights")
            expect(mockUse).toHaveBeenCalledWith({ namespace: "celery_insights" })
            expect(mockQuery).toHaveBeenCalledWith("DEFINE DATABASE IF NOT EXISTS main")
            expect(mockUse).toHaveBeenCalledWith({ namespace: "celery_insights", database: "main" })
        })
    })

    it("applies demo schema after connecting", async () => {
        render(
            <SurrealDBProvider>
                <ConsumerComponent />
            </SurrealDBProvider>,
        )

        await waitFor(() => {
            // Schema query should contain task table definition with FULL permissions
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("DEFINE TABLE IF NOT EXISTS task"))
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("PERMISSIONS FULL"))
        })
    })

    it("renders children after initialization completes", async () => {
        render(
            <SurrealDBProvider>
                <ConsumerComponent />
            </SurrealDBProvider>,
        )

        await waitFor(() => {
            expect(screen.getByTestId("ingestion")).toHaveTextContent("disabled")
        })
    })

    it("sets ingestion status to disabled in demo mode", async () => {
        render(
            <SurrealDBProvider>
                <ConsumerComponent />
            </SurrealDBProvider>,
        )

        await waitFor(() => {
            expect(screen.getByTestId("ingestion")).toHaveTextContent("disabled")
        })
    })

    it("does not fetch /api/config in demo mode", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch")

        render(
            <SurrealDBProvider>
                <ConsumerComponent />
            </SurrealDBProvider>,
        )

        await waitFor(() => {
            expect(screen.getByTestId("ingestion")).toHaveTextContent("disabled")
        })

        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it("shows error when WASM initialization fails", async () => {
        mockConnect.mockRejectedValueOnce(new Error("WASM init failed"))

        render(
            <SurrealDBProvider>
                <ConsumerComponent />
            </SurrealDBProvider>,
        )

        await waitFor(() => {
            expect(screen.getByText("Error: WASM init failed")).toBeInTheDocument()
        })
    })

    it("cleans up embedded database on unmount", async () => {
        const { unmount } = render(
            <SurrealDBProvider>
                <ConsumerComponent />
            </SurrealDBProvider>,
        )

        await waitFor(() => {
            expect(screen.getByTestId("ingestion")).toHaveTextContent("disabled")
        })

        unmount()
        expect(mockClose).toHaveBeenCalled()
    })
})

describe("useSurrealDB", () => {
    beforeEach(() => {
        useSettingsStore.setState({ demo: false })
    })

    it("throws error when used outside provider", () => {
        // Suppress console.error for this test
        const spy = vi.spyOn(console, "error").mockImplementation(() => {})

        expect(() => render(<ConsumerComponent />)).toThrow("useSurrealDB must be used within SurrealDBProvider")

        spy.mockRestore()
    })
})
