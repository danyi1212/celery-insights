import { parseTimeRange, type TimeRange } from "@danyi1212/time-range-picker"
import { getTimeRangeDurationMs, resolveTimeRangeToIso } from "@danyi1212/time-range-picker/time-range"

const DEFAULT_TIME_RANGE_INPUT = "1h"
const RANGE_SERIALIZER_VERSION = "v1"

export const createDefaultTimeRange = (referenceDate: Date = new Date()): TimeRange =>
  parseTimeRange(DEFAULT_TIME_RANGE_INPUT, referenceDate)!

export const getTimeRangeBucketDuration = (range: TimeRange, referenceDate: Date = new Date()): string => {
  const durationMs = Math.max(getTimeRangeDurationMs(range, referenceDate), 60_000)

  if (durationMs <= 60 * 60 * 1000) return "1m"
  if (durationMs <= 6 * 60 * 60 * 1000) return "10m"
  if (durationMs <= 24 * 60 * 60 * 1000) return "30m"
  if (durationMs <= 7 * 24 * 60 * 60 * 1000) return "360m"
  if (durationMs <= 30 * 24 * 60 * 60 * 1000) return "1440m"
  if (durationMs <= 90 * 24 * 60 * 60 * 1000) return "10080m"
  return "43200m"
}

export const resolveTimeRangeBindings = (range: TimeRange, referenceDate: Date = new Date()) => {
  const { start, end } = resolveTimeRangeToIso(range, referenceDate)
  return {
    from: start,
    to: end,
    bucketDuration: getTimeRangeBucketDuration(range, referenceDate),
  }
}

const isValidDate = (value: Date) => !Number.isNaN(value.getTime())

const parseIsoDate = (value: string): Date | null => {
  const date = new Date(value)
  return isValidDate(date) ? date : null
}

export const serializeTimeRange = (range: TimeRange): string => {
  if (range.mode === "live") {
    if (range.liveRange.mode === "relative") {
      return `${RANGE_SERIALIZER_VERSION}:relative:${range.liveRange.duration.value}:${range.liveRange.duration.unit}`
    }

    if (range.liveRange.mode === "calendarStart") {
      const weekStartsOn = range.liveRange.weekStartsOn ?? "default"
      return `${RANGE_SERIALIZER_VERSION}:calendar:${range.liveRange.unit}:${weekStartsOn}`
    }

    return `${RANGE_SERIALIZER_VERSION}:anchored:${range.start.toISOString()}`
  }

  return `${RANGE_SERIALIZER_VERSION}:static:${range.start.toISOString()}|${range.end.toISOString()}`
}

export const deserializeTimeRange = (value: string, referenceDate: Date = new Date()): TimeRange | null => {
  if (value.startsWith(`${RANGE_SERIALIZER_VERSION}:`)) {
    const [, mode, ...rest] = value.split(":")

    if (mode === "relative") {
      const [rawValue, unit] = rest
      const durationValue = Number(rawValue)
      if (Number.isFinite(durationValue) && ["minute", "hour", "day", "week", "month"].includes(unit ?? "")) {
        return {
          mode: "live",
          start: referenceDate,
          end: referenceDate,
          isLive: true,
          liveRange: {
            mode: "relative",
            duration: {
              value: durationValue,
              unit: unit as "minute" | "hour" | "day" | "week" | "month",
            },
          },
        }
      }
      return null
    }

    if (mode === "calendar") {
      const [unit, rawWeekStartsOn] = rest
      if (unit === "day" || unit === "week" || unit === "month") {
        const parsedWeekStartsOn = rawWeekStartsOn === "default" ? undefined : Number(rawWeekStartsOn)
        return {
          mode: "live",
          start: referenceDate,
          end: referenceDate,
          isLive: true,
          liveRange: {
            mode: "calendarStart",
            unit,
            weekStartsOn: Number.isInteger(parsedWeekStartsOn)
              ? (parsedWeekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6)
              : undefined,
          },
        }
      }
      return null
    }

    if (mode === "anchored") {
      const isoStart = rest.join(":")
      const start = parseIsoDate(isoStart)
      if (!start) return null
      return {
        mode: "live",
        start,
        end: referenceDate,
        isLive: true,
        liveRange: { mode: "anchored" },
      }
    }

    if (mode === "static") {
      const [startToken, endToken] = value.slice(`${RANGE_SERIALIZER_VERSION}:static:`.length).split("|")
      const start = parseIsoDate(startToken)
      const end = parseIsoDate(endToken)
      if (!start || !end) return null
      return {
        mode: "static",
        start,
        end,
        isLive: false,
      }
    }
  }

  return parseTimeRange(value, referenceDate)
}
