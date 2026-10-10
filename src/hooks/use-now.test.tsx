import { render, renderHook, act } from "@testing-library/react"
import React from "react"
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

  it("keeps the last tick instead of the mount time when ticking is disabled", () => {
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"))
    const { result, rerender } = renderHook(({ interval }: { interval?: number }) => useNow(interval), {
      initialProps: { interval: 1000 } as { interval?: number },
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    const lastTick = result.current
    expect(lastTick.getTime()).toBe(Date.parse("2025-01-01T00:00:02Z"))

    rerender({ interval: undefined })
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current).toBe(lastTick)
  })

  it("starts no timer and leaves no ticker behind for a render that never subscribes", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval")
    const Throwing = () => {
      useNow(1000)
      throw new Error("aborted render")
    }
    class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
      state = { failed: false }
      static getDerivedStateFromError = () => ({ failed: true })
      render = () => (this.state.failed ? null : this.props.children)
    }
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    render(
      <Boundary>
        <Throwing />
      </Boundary>,
    )
    consoleError.mockRestore()
    expect(setIntervalSpy).not.toHaveBeenCalled()

    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"))
    const { result } = renderHook(() => useNow(1000))
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.getTime()).toBe(Date.parse("2025-01-01T00:00:01Z"))
    setIntervalSpy.mockRestore()
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
