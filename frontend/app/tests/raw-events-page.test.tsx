import { render, screen, waitFor } from "@test-utils"
import userEvent from "@testing-library/user-event"
import useSettingsStore from "@stores/use-settings-store"
import { RawEventsPage } from "../routes/raw_events"

const mockUseLiveEvents = vi.fn()

vi.mock("@components/surrealdb-provider", () => ({
    useSurrealDB: () => ({
        status: "connected",
        ingestionStatus: "disabled",
        error: null,
        appConfig: null,
    }),
}))

vi.mock("@hooks/use-live-events", () => ({
    useLiveEvents: (limit: number, enabled: boolean) => mockUseLiveEvents(limit, enabled),
}))

vi.mock("@hooks/use-keyboard-shortcuts", () => ({
    useKeyboardShortcuts: () => undefined,
}))

vi.mock("@components/task/task-avatar", () => ({
    default: ({ taskId }: { taskId: string }) => <div>{taskId}</div>,
}))

const baseEvent = {
    data: { name: "demo.task" },
    id: "event:1",
    task_id: "task-1",
    timestamp: "2026-03-19T12:00:00Z",
}

describe("RawEventsPage", () => {
    beforeEach(() => {
        mockUseLiveEvents.mockReset()
        useSettingsStore.setState({ demo: false, rawEventsLimit: 100 })
    })

    it("renders demo events instead of a demo-only placeholder", async () => {
        useSettingsStore.setState({ demo: true })
        mockUseLiveEvents.mockReturnValue({
            data: [{ ...baseEvent, event_type: "task-received" }],
            isLoading: false,
        })

        render(<RawEventsPage />)

        expect(mockUseLiveEvents).toHaveBeenCalledWith(100, true)
        expect(await screen.findAllByText("task-received")).not.toHaveLength(0)
        expect(screen.queryByText("Live Events are not available in Demo Mode.")).not.toBeInTheDocument()
    })

    it("freezes the current list in demo mode and resumes live updates when reconnected", async () => {
        useSettingsStore.setState({ demo: true })
        let liveEvents = [{ ...baseEvent, event_type: "task-received" }]
        mockUseLiveEvents.mockImplementation((_limit: number, _enabled: boolean) => ({
            data: liveEvents,
            isLoading: false,
        }))

        const user = userEvent.setup()
        const { rerender } = render(<RawEventsPage />)

        expect(await screen.findAllByText("task-received")).not.toHaveLength(0)

        await user.click(screen.getByRole("button", { name: "Freeze live events" }))

        liveEvents = [
            {
                ...baseEvent,
                id: "event:2",
                event_type: "task-started",
                task_id: "task-2",
                timestamp: "2026-03-19T12:01:00Z",
            },
        ]
        rerender(<RawEventsPage />)

        expect(screen.getAllByText("task-received")).not.toHaveLength(0)
        expect(screen.queryByText("task-started")).not.toBeInTheDocument()

        await user.click(screen.getByRole("button", { name: "Connect live events" }))

        await waitFor(() => {
            expect(screen.getAllByText("task-started")).not.toHaveLength(0)
        })
    })
})
