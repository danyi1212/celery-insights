import { useCallback, useRef, useState, useSyncExternalStore } from "react"

interface Ticker {
  now?: Date
  listeners: Set<() => void>
  timer?: ReturnType<typeof setInterval>
}

// One timer per interval, shared by every subscriber, so hundreds of badges tick (and re-render) together.
// Entries exist only while subscribed; `now` stays unset until the first tick so render has no side effects.
const tickers = new Map<number, Ticker>()

const subscribeTicker = (interval: number, listener: () => void): (() => void) => {
  const ticker = tickers.get(interval) ?? { listeners: new Set<() => void>() }
  tickers.set(interval, ticker)
  ticker.listeners.add(listener)
  ticker.timer ??= setInterval(() => {
    ticker.now = new Date()
    ticker.listeners.forEach((notify) => notify())
  }, interval)
  return () => {
    ticker.listeners.delete(listener)
    if (ticker.listeners.size > 0) return
    clearInterval(ticker.timer)
    tickers.delete(interval)
  }
}

export const useNow = (interval?: number): Date => {
  const [mountedAt] = useState(() => new Date())
  // Monotonic per caller: never before its mount, and never backwards when ticking stops.
  const lastReported = useRef(mountedAt)
  const subscribe = useCallback(
    (listener: () => void) => (interval ? subscribeTicker(interval, listener) : () => {}),
    [interval],
  )
  const getSnapshot = useCallback(() => {
    const shared = interval ? tickers.get(interval)?.now : undefined
    if (shared && shared > lastReported.current) lastReported.current = shared
    return lastReported.current
  }, [interval])
  return useSyncExternalStore(subscribe, getSnapshot)
}
