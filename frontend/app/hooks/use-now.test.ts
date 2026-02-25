import { renderHook, act } from "@testing-library/react"
import { useNow } from "./use-now"

describe("useNow", () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it("returns a Date initially", () => {
        const { result } = renderHook(() => useNow())
        expect(result.current).toBeInstanceOf(Date)
    })

    it("does not update without an interval", () => {
        const { result } = renderHook(() => useNow())
        const initial = result.current.getTime()

        act(() => {
            vi.advanceTimersByTime(5000)
        })

        expect(result.current.getTime()).toBe(initial)
    })

    it("updates at the specified interval", () => {
        vi.setSystemTime(new Date("2025-01-01T00:00:00Z"))
        const { result } = renderHook(() => useNow(1000))
        const initial = result.current.getTime()

        act(() => {
            vi.advanceTimersByTime(1000)
        })

        expect(result.current.getTime()).toBeGreaterThan(initial)

        const afterFirst = result.current.getTime()
        act(() => {
            vi.advanceTimersByTime(1000)
        })

        expect(result.current.getTime()).toBeGreaterThan(afterFirst)
    })

    it("clears interval on unmount", () => {
        const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval")
        const { unmount } = renderHook(() => useNow(1000))

        unmount()

        expect(clearIntervalSpy).toHaveBeenCalled()
        clearIntervalSpy.mockRestore()
    })

    it("restarts interval when interval value changes", () => {
        const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval")
        const { rerender } = renderHook(({ interval }) => useNow(interval), {
            initialProps: { interval: 1000 },
        })

        rerender({ interval: 500 })

        expect(clearIntervalSpy).toHaveBeenCalled()
        clearIntervalSpy.mockRestore()
    })
})
