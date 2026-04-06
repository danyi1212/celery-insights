import { deserializeTimeRange, serializeTimeRange } from "./time-range-utils"

describe("time range URL serialization", () => {
  const referenceDate = new Date("2026-04-06T10:04:00Z")

  it("round-trips relative live ranges without falling back to anchored parsing", () => {
    const range = deserializeTimeRange("24h", referenceDate)
    expect(range).not.toBeNull()

    const serialized = serializeTimeRange(range!)
    const roundTripped = deserializeTimeRange(serialized, referenceDate)

    expect(roundTripped).toMatchObject({
      mode: "live",
      liveRange: {
        mode: "relative",
        duration: { value: 24, unit: "hour" },
      },
    })
  })

  it("round-trips static ranges with exact bounds", () => {
    const range = {
      mode: "static" as const,
      start: new Date("2026-04-05T13:04:00.000Z"),
      end: new Date("2026-04-05T15:04:00.000Z"),
      isLive: false,
    }

    const serialized = serializeTimeRange(range)
    const roundTripped = deserializeTimeRange(serialized, referenceDate)

    expect(roundTripped).toMatchObject({ mode: "static" })
    expect(roundTripped?.start.toISOString()).toBe("2026-04-05T13:04:00.000Z")
    expect(roundTripped?.end.toISOString()).toBe("2026-04-05T15:04:00.000Z")
  })
})
