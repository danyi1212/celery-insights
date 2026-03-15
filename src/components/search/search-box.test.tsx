import { appShortcuts } from "@components/keyboard/shortcut-definitions"
import { act, render, screen } from "@test-utils"
import userEvent from "@testing-library/user-event"
import useSettingsStore from "@stores/use-settings-store"
import SearchBox from "./search-box"

const mockNavigate = vi.fn()
const mockUseSearch = vi.fn()
const registerSearchBox = vi.fn()

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock("@components/search/search-box-controller", () => ({
  useSearchBoxController: () => ({
    registerSearchBox,
  }),
}))

vi.mock("@hooks/use-search", () => ({
  useSearch: (query: string, limit?: number) => mockUseSearch(query, limit),
}))

vi.mock("@components/task/task-avatar", () => ({
  default: ({ taskId }: { taskId: string }) => <div data-testid={`task-avatar-${taskId}`}>avatar</div>,
}))

describe("SearchBox", () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    registerSearchBox.mockReset()
    registerSearchBox.mockImplementation(() => vi.fn())
    mockUseSearch.mockImplementation((query: string) => {
      if (query.toLowerCase().includes("noop")) {
        return {
          tasks: [
            {
              id: "task:abc123",
              type: "tasks.basic.noop",
              state: "SUCCESS",
              sent_at: "2026-03-10T10:00:00Z",
              last_updated: "2026-03-10T10:00:00Z",
              children: [],
            },
          ],
          workers: [
            {
              id: "worker:worker-1",
              hostname: "celery@worker-1",
              pid: 1234,
              status: "online",
              last_updated: "2026-03-10T10:00:00Z",
            },
          ],
          isLoading: false,
          error: null,
        }
      }

      return {
        tasks: [],
        workers: [],
        isLoading: false,
        error: null,
      }
    })
    useSettingsStore.setState({ demo: false })
  })

  it("opens the quick access dialog when the search trigger is clicked", async () => {
    const user = userEvent.setup()

    render(<SearchBox />)

    await user.click(screen.getByRole("button", { name: "Open quick search" }))

    expect(screen.getByPlaceholderText("Search tasks, workers, pages, and features...")).toBeInTheDocument()
    expect(screen.getByText("Dashboard")).toBeInTheDocument()
  })

  it("opens the quick access dialog through the registered search controller", () => {
    render(<SearchBox />)

    const controls = registerSearchBox.mock.calls[0][0]
    act(() => controls.focus())

    expect(screen.getByPlaceholderText("Search tasks, workers, pages, and features...")).toBeInTheDocument()
  })

  it("advertises Cmd/Ctrl+K as the search shortcut", () => {
    expect(appShortcuts.focusSearch).toEqual([{ key: "k", mod: true }])
  })

  it("matches feature keywords against navigation destinations", async () => {
    const user = userEvent.setup()

    render(<SearchBox />)

    await user.click(screen.getByRole("button", { name: "Open quick search" }))
    await user.type(screen.getByPlaceholderText("Search tasks, workers, pages, and features..."), "backup")

    expect(screen.getByText("Settings")).toBeInTheDocument()
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument()
  })

  it("shows documentation pages in the quick access dialog", async () => {
    const user = userEvent.setup()

    render(<SearchBox />)

    await user.click(screen.getByRole("button", { name: "Open quick search" }))
    await user.type(screen.getByPlaceholderText("Search tasks, workers, pages, and features..."), "kubernetes")

    expect(screen.getByRole("option", { name: /kubernetes and hpa/i })).toBeInTheDocument()
  })

  it("navigates to a matching documentation page when Enter is pressed", async () => {
    const user = userEvent.setup()

    render(<SearchBox />)

    await user.click(screen.getByRole("button", { name: "Open quick search" }))
    await user.type(screen.getByPlaceholderText("Search tasks, workers, pages, and features..."), "production notes")
    await user.keyboard("{Enter}")

    expect(mockNavigate).toHaveBeenCalledWith({ to: "/documentation/production-notes" })
  })

  it("shows task and worker results in the quick access dialog", async () => {
    const user = userEvent.setup()

    render(<SearchBox />)

    await user.click(screen.getByRole("button", { name: "Open quick search" }))
    await user.type(screen.getByPlaceholderText("Search tasks, workers, pages, and features..."), "noop")

    expect(screen.getByRole("option", { name: /tasks\.basic\.noop/i })).toBeInTheDocument()
    expect(screen.getByText("celery@worker-1")).toBeInTheDocument()
  })

  it("navigates to the highlighted destination when Enter is pressed", async () => {
    const user = userEvent.setup()

    render(<SearchBox />)

    await user.click(screen.getByRole("button", { name: "Open quick search" }))
    await user.type(screen.getByPlaceholderText("Search tasks, workers, pages, and features..."), "settings")
    await user.keyboard("{Enter}")

    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" })
  })
})
