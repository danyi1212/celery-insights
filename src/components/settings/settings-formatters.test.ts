import {
  describeDurability,
  formatConnectionStatus,
  formatDurability,
  formatIngestionStatus,
  formatStorageEngine,
  formatTopology,
  formatVersion,
} from "./settings-formatters"

describe("settings formatters", () => {
  it("formats connectivity labels", () => {
    expect(formatConnectionStatus("connected")).toBe("Connected")
    expect(formatIngestionStatus("standby")).toBe("Standby")
  })

  it("formats topology and durability labels", () => {
    expect(formatTopology("embedded")).toBe("Embedded")
    expect(formatTopology("external")).toBe("External")
    expect(formatDurability("memory")).toBe("Ephemeral (memory)")
    expect(formatDurability("persistent")).toBe("Persistent disk")
    expect(formatDurability("external")).toBe("Managed externally")
  })

  it("describes durability expectations", () => {
    expect(describeDurability("memory")).toMatch(/disappears/i)
    expect(describeDurability("persistent")).toMatch(/survives/i)
    expect(describeDurability("external")).toMatch(/shared SurrealDB/i)
  })

  it("formats storage engine fallback", () => {
    expect(formatStorageEngine("memory")).toBe("memory")
    expect(formatStorageEngine(null)).toBe("Managed externally")
  })

  it("formats version strings without double prefixing", () => {
    expect(formatVersion("0.2.0")).toBe("v0.2.0")
    expect(formatVersion("v0.2.0")).toBe("v0.2.0")
    expect(formatVersion()).toBe("—")
  })
})
