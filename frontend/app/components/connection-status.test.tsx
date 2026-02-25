import { render, screen } from "@test-utils"
import { ConnectionStatusIndicator, ReadOnlyBanner } from "./connection-status"
import type { IngestionStatus } from "./surrealdb-provider"
import type { ConnectionStatus } from "surrealdb"

const mockUseSurrealDB = vi.fn()

vi.mock("@components/surrealdb-provider", () => ({
    useSurrealDB: () => mockUseSurrealDB(),
}))

function setMockContext(status: ConnectionStatus, ingestionStatus: IngestionStatus, error: Error | null = null) {
    mockUseSurrealDB.mockReturnValue({ db: {}, status, ingestionStatus, error })
}

describe("ConnectionStatusIndicator", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("shows connected state with green checkmark", () => {
        setMockContext("connected", "leader")
        render(<ConnectionStatusIndicator />)

        expect(screen.getByText("Connected")).toBeInTheDocument()
    })

    it("shows reconnecting state", () => {
        setMockContext("reconnecting", "leader")
        render(<ConnectionStatusIndicator />)

        expect(screen.getByText("Reconnecting...")).toBeInTheDocument()
    })

    it("shows disconnected state", () => {
        setMockContext("disconnected", "leader")
        render(<ConnectionStatusIndicator />)

        expect(screen.getByText("Disconnected")).toBeInTheDocument()
    })

    it("shows connecting state", () => {
        setMockContext("connecting", "leader")
        render(<ConnectionStatusIndicator />)

        expect(screen.getByText("Connecting...")).toBeInTheDocument()
    })

    it("shows ingestion status when connected and not leader", () => {
        setMockContext("connected", "standby")
        render(<ConnectionStatusIndicator />)

        expect(screen.getByText("Standby")).toBeInTheDocument()
        expect(screen.getByText("Connected")).toBeInTheDocument()
    })

    it("shows read-only ingestion status when connected", () => {
        setMockContext("connected", "read-only")
        render(<ConnectionStatusIndicator />)

        expect(screen.getByText("Read-only")).toBeInTheDocument()
    })

    it("shows disabled ingestion status when connected", () => {
        setMockContext("connected", "disabled")
        render(<ConnectionStatusIndicator />)

        expect(screen.getByText("Disabled")).toBeInTheDocument()
    })

    it("does not show ingestion status when connected as leader", () => {
        setMockContext("connected", "leader")
        render(<ConnectionStatusIndicator />)

        expect(screen.queryByText("Ingesting")).not.toBeInTheDocument()
    })

    it("does not show ingestion status when disconnected", () => {
        setMockContext("disconnected", "standby")
        render(<ConnectionStatusIndicator />)

        expect(screen.queryByText("Standby")).not.toBeInTheDocument()
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
})
