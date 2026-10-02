import { createStaticTimeRange, deserializeTimeRange, serializeTimeRange } from "./time-range-utils"

describe("time range URL serialization", () => {
  const referenceDate = new Date("2026-04-06T10:04:00Z")

  it("round-trips relative live ranges without falling back to anchored parsing", () => {
    const range = deserializeTimeRange("1h", referenceDate)
    expect(range).not.toBeNull()

    const serialized = serializeTimeRange(range!)
    const roundTripped = deserializeTimeRange(serialized, referenceDate)

    expect(roundTripped).toMatchObject({
      mode: "live",
      liveRange: {
        mode: "relative",
        duration: { value: 1, unit: "hour" },
      },
    })
  })

  it("uses past one hour as the default range", () => {
    const range = deserializeTimeRange("1h", referenceDate)
    expect(serializeTimeRange(range!)).toBe("v1:relative:1:hour")
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

  it("creates a static range from valid dates", () => {
    const range = createStaticTimeRange(new Date("2026-04-05T13:04:00.000Z"), new Date("2026-04-05T15:04:00.000Z"))

    expect(range).toMatchObject({ mode: "static", isLive: false })
    expect(range?.start.toISOString()).toBe("2026-04-05T13:04:00.000Z")
    expect(range?.end.toISOString()).toBe("2026-04-05T15:04:00.000Z")
  })

  it("rejects invalid static ranges", () => {
    expect(createStaticTimeRange(new Date("2026-04-05T15:04:00.000Z"), new Date("2026-04-05T13:04:00.000Z"))).toBeNull()
  })
})
