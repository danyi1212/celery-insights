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

  it("shares one timer between subscribers with the same interval", () => {
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"))
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval")
    const first = renderHook(() => useNow(1000))
    const second = renderHook(() => useNow(1000))
    expect(setIntervalSpy).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(first.result.current).toBe(second.result.current)
    expect(first.result.current.getTime()).toBe(Date.parse("2025-01-01T00:00:01Z"))

    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval")
    first.unmount()
    expect(clearIntervalSpy).not.toHaveBeenCalled()
    second.unmount()
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1)
    setIntervalSpy.mockRestore()
    clearIntervalSpy.mockRestore()
  })

  it("never returns a time before a late subscriber mounted", () => {
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"))
    const first = renderHook(() => useNow(10_000))
    vi.setSystemTime(new Date("2025-01-01T00:00:07Z"))
    const second = renderHook(() => useNow(10_000))

    expect(first.result.current.getTime()).toBe(Date.parse("2025-01-01T00:00:00Z"))
    expect(second.result.current.getTime()).toBe(Date.parse("2025-01-01T00:00:07Z"))

    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(first.result.current).toBe(second.result.current)
    first.unmount()
    second.unmount()
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
