import { render, screen, waitFor } from "@test-utils"
import userEvent from "@testing-library/user-event"
import { TaskState } from "@services/server"
import TaskAvatar from "./task-avatar"

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, to, ...props }: { children?: React.ReactNode; to: string; [key: string]: unknown }) => (
        <a href={to} {...props}>
            {children}
        </a>
    ),
}))

describe("TaskAvatar", () => {
    it("renders a link to /tasks/{taskId} by default", () => {
        render(<TaskAvatar taskId="abc-123" type="app.tasks.add" />)
        const link = screen.getByRole("link")
        expect(link).toHaveAttribute("href", "/tasks/abc-123")
    })

    it("renders a div instead of link when disableLink is set", () => {
        render(<TaskAvatar taskId="abc-123" type="app.tasks.add" disableLink />)
        expect(screen.queryByRole("link")).not.toBeInTheDocument()
    })

    it("sets background color based on task type", () => {
        const { container } = render(<TaskAvatar taskId="abc-123" type="app.tasks.add" />)
        const avatarEl = container.querySelector("[style]")
        expect(avatarEl).not.toBeNull()
        expect(avatarEl?.getAttribute("style")).toContain("background-color")
    })

    it("does not set background color when type is null", () => {
        const { container } = render(<TaskAvatar taskId="abc-123" type={null} />)
        const styled = container.querySelectorAll("[style]")
        const hasBackgroundColor = Array.from(styled).some((el) =>
            el.getAttribute("style")?.includes("background-color"),
        )
        expect(hasBackgroundColor).toBe(false)
    })

    it("renders status badge when status is provided", () => {
        const { container } = render(<TaskAvatar taskId="abc-123" type="app.tasks.add" status={TaskState.SUCCESS} />)
        const badge = container.querySelector("span.absolute")
        expect(badge).not.toBeNull()
        const svg = badge?.querySelector("svg")
        expect(svg).not.toBeNull()
    })

    it("does not render status badge when status is omitted", () => {
        const { container } = render(<TaskAvatar taskId="abc-123" type="app.tasks.add" />)
        const badge = container.querySelector("span.absolute")
        expect(badge).toBeNull()
    })

    it("displays taskId and type in tooltip content", async () => {
        const user = userEvent.setup()
        const { container } = render(<TaskAvatar taskId="abc-123" type="app.tasks.add" />)
        const trigger = container.querySelector("[data-slot='tooltip-trigger']")!
        await user.hover(trigger)
        await waitFor(() => {
            const tooltip = screen.getByRole("tooltip")
            expect(tooltip).toHaveTextContent("abc-123")
            expect(tooltip).toHaveTextContent("app.tasks.add")
        })
    })
})
