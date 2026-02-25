import { getBrightness } from "./color-utils"

describe("getBrightness", () => {
    it("returns 100 for white", () => {
        expect(getBrightness("#ffffff")).toBe(100)
    })

    it("returns 0 for black", () => {
        expect(getBrightness("#000000")).toBe(0)
    })

    it("computes correct brightness for pure red", () => {
        // 0.2126 * 255 / 255 * 100 = 21.26 -> 21
        expect(getBrightness("#ff0000")).toBe(21)
    })

    it("computes correct brightness for pure green", () => {
        // 0.7152 * 255 / 255 * 100 = 71.52 -> 72
        expect(getBrightness("#00ff00")).toBe(72)
    })

    it("computes correct brightness for pure blue", () => {
        // 0.0722 * 255 / 255 * 100 = 7.22 -> 7
        expect(getBrightness("#0000ff")).toBe(7)
    })

    it("handles uppercase hex", () => {
        expect(getBrightness("#FFFFFF")).toBe(100)
        expect(getBrightness("#FF0000")).toBe(21)
    })
})
