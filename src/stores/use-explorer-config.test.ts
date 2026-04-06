import { renderHook } from "@testing-library/react"
import { useExplorerConfig, useExplorerColumns, useExplorerFilters } from "./use-explorer-config"

describe("useExplorerConfig", () => {
  it("has the expected default column order", () => {
    const state = useExplorerConfig.getState()
    expect(state.columnOrder).toEqual(["last_updated", "state", "id", "type", "worker"])
  })

  it("has the expected default filter order", () => {
    const state = useExplorerConfig.getState()
    expect(state.filterOrder).toEqual(["state", "type", "result", "worker"])
  })
})

describe("useExplorerColumns", () => {
  it("returns only columns with showColumn: true in order", () => {
    const { result } = renderHook(() => useExplorerColumns())

    const labels = result.current.map((col) => col.label)
    expect(labels).toEqual(["Last Updated", "Type (name)"])
  })

  it("excludes columns with showColumn: false", () => {
    const { result } = renderHook(() => useExplorerColumns())

    const properties = result.current.map((col) => col.property)
    expect(properties).not.toContain("state")
    expect(properties).not.toContain("id")
    expect(properties).not.toContain("worker")
  })
})

describe("useExplorerFilters", () => {
  it("returns filters with showFilter: true, excluding noFilter columns", () => {
    const { result } = renderHook(() => useExplorerFilters())

    const properties = result.current.map((filterConfig) => filterConfig.property)
    expect(properties).toEqual(["state", "type", "result", "worker"])
  })

  it("excludes lastUpdated because it has noFilter: true", () => {
    const { result } = renderHook(() => useExplorerFilters())

    const properties = result.current.map((filterConfig) => filterConfig.property)
    expect(properties).not.toContain("last_updated")
  })
})
