import { render, screen, within } from "@test-utils"
import userEvent from "@testing-library/user-event"
import Facet from "./facet"

const defaultCounts = new Map([
    ["alpha", 10],
    ["beta", 5],
    ["gamma", 20],
])

describe("Facet", () => {
    it("renders the title", () => {
        render(<Facet title="Status" counts={defaultCounts} selected={new Set()} setSelected={vi.fn()} />)
        expect(screen.getByText("Status")).toBeInTheDocument()
    })

    it("sorts values by count descending", () => {
        render(<Facet title="Type" counts={defaultCounts} selected={new Set()} setSelected={vi.fn()} />)
        const items = screen.getAllByRole("listitem")
        // Each listitem contains the value label and count text
        const values = items.map((item) => {
            const texts = within(item).getAllByText(/.+/)
            return texts[0].textContent
        })
        // gamma(20) > alpha(10) > beta(5)
        expect(values).toEqual(["gamma", "alpha", "beta"])
    })

    it("calls setSelected to add a value on click", async () => {
        const user = userEvent.setup()
        const setSelected = vi.fn()
        render(<Facet title="Type" counts={defaultCounts} selected={new Set()} setSelected={setSelected} />)

        // Click on the list item button for "alpha"
        const items = screen.getAllByRole("listitem")
        const alphaItem = items.find((item) => item.textContent?.includes("alpha"))!
        const button = within(alphaItem).getByRole("button")
        await user.click(button)
        expect(setSelected).toHaveBeenCalledWith(new Set(["alpha"]))
    })

    it("calls setSelected to remove a value on click when already selected", async () => {
        const user = userEvent.setup()
        const setSelected = vi.fn()
        render(
            <Facet
                title="Type"
                counts={defaultCounts}
                selected={new Set(["alpha", "beta"])}
                setSelected={setSelected}
            />,
        )

        const items = screen.getAllByRole("listitem")
        const alphaItem = items.find((item) => item.textContent?.includes("alpha"))!
        const button = within(alphaItem).getByRole("button")
        await user.click(button)
        expect(setSelected).toHaveBeenCalledWith(new Set(["beta"]))
    })

    it("clears all selections on clear button click", async () => {
        const user = userEvent.setup()
        const setSelected = vi.fn()
        render(
            <Facet
                title="Type"
                counts={defaultCounts}
                selected={new Set(["alpha", "beta"])}
                setSelected={setSelected}
            />,
        )

        const clearButton = screen.getByRole("button", { name: "Clear selection" })
        await user.click(clearButton)
        expect(setSelected).toHaveBeenCalledWith(new Set())
    })

    it("filters values by search input", async () => {
        const user = userEvent.setup()
        render(<Facet title="Type" counts={defaultCounts} selected={new Set()} setSelected={vi.fn()} />)

        const searchInput = screen.getByPlaceholderText("Filter values...")
        await user.type(searchInput, "alp")

        const items = screen.getAllByRole("listitem")
        expect(items).toHaveLength(1)
        expect(items[0].textContent).toContain("alpha")
    })

    it("search filtering is case-insensitive", async () => {
        const user = userEvent.setup()
        render(<Facet title="Type" counts={defaultCounts} selected={new Set()} setSelected={vi.fn()} />)

        const searchInput = screen.getByPlaceholderText("Filter values...")
        await user.type(searchInput, "BETA")

        const items = screen.getAllByRole("listitem")
        expect(items).toHaveLength(1)
        expect(items[0].textContent).toContain("beta")
    })

    it("uses custom valueFormatter when provided", () => {
        const formatter = (value: string) => <span data-testid="formatted">{value.toUpperCase()}</span>
        render(
            <Facet
                title="Type"
                counts={defaultCounts}
                selected={new Set()}
                setSelected={vi.fn()}
                valueFormatter={formatter}
            />,
        )

        const formatted = screen.getAllByTestId("formatted")
        expect(formatted).toHaveLength(3)
        // First should be gamma (highest count)
        expect(formatted[0].textContent).toBe("GAMMA")
    })
})
