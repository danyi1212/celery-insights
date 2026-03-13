import { render, screen } from "@test-utils"
import { ShortcutHint } from "./shortcut-hint"

describe("ShortcutHint", () => {
    it("renders shifted punctuation shortcuts explicitly", () => {
        render(<ShortcutHint sequence={[{ key: "?", shift: true }]} />)

        expect(screen.getByText("Shift")).toBeInTheDocument()
        expect(screen.getByText("?")).toBeInTheDocument()
    })
})
