import { useCallback, useState, useSyncExternalStore } from "react"

interface Ticker {
  now: Date
  listeners: Set<() => void>
  timer?: ReturnType<typeof setInterval>
}

// One timer per interval, shared by every subscriber, so hundreds of badges tick (and re-render) together.
const tickers = new Map<number, Ticker>()

const getTicker = (interval: number): Ticker => {
  const existing = tickers.get(interval)
  if (existing) return existing
  const ticker: Ticker = { now: new Date(), listeners: new Set() }
  tickers.set(interval, ticker)
  return ticker
}

const subscribeTicker = (interval: number, listener: () => void): (() => void) => {
  const ticker = getTicker(interval)
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
  const subscribe = useCallback(
    (listener: () => void) => (interval ? subscribeTicker(interval, listener) : () => {}),
    [interval],
  )
  // The shared tick can predate this mount; never report a time before the caller mounted.
  const getSnapshot = useCallback(() => {
    const shared = interval ? getTicker(interval).now : mountedAt
    return shared > mountedAt ? shared : mountedAt
  }, [interval, mountedAt])
  return useSyncExternalStore(subscribe, getSnapshot)
}
