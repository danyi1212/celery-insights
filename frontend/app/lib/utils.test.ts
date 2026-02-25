import { cn } from "./utils"

describe("cn", () => {
    it("merges multiple class strings", () => {
        expect(cn("foo", "bar")).toBe("foo bar")
    })

    it("handles conditional classes via clsx", () => {
        expect(cn("base", false && "hidden", "visible")).toBe("base visible")
        expect(cn("base", true && "shown")).toBe("base shown")
    })

    it("resolves Tailwind conflicts via twMerge", () => {
        expect(cn("px-2", "px-4")).toBe("px-4")
        expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500")
    })

    it("handles undefined and null inputs", () => {
        expect(cn("base", undefined, null)).toBe("base")
    })

    it("handles empty inputs", () => {
        expect(cn()).toBe("")
        expect(cn("")).toBe("")
    })

    it("handles object syntax from clsx", () => {
        expect(cn({ "font-bold": true, hidden: false })).toBe("font-bold")
    })
})
