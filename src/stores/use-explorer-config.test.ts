import { renderHook } from "@testing-library/react"
import { useExplorerConfig, useExplorerColumns, useExplorerFacets } from "./use-explorer-config"

describe("useExplorerConfig", () => {
  it("has the expected default column order", () => {
    const state = useExplorerConfig.getState()
    expect(state.columnOrder).toEqual(["last_updated", "state", "id", "type", "worker"])
  })

  it("has the expected default facet order", () => {
    const state = useExplorerConfig.getState()
    expect(state.facetOrder).toEqual(["state", "type", "result", "worker"])
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

describe("useExplorerFacets", () => {
  it("returns facets with showFacet: true, excluding noFacet columns", () => {
    const { result } = renderHook(() => useExplorerFacets())

    const properties = result.current.map((facet) => facet.property)
    expect(properties).toEqual(["state", "type", "result", "worker"])
  })

  it("excludes lastUpdated because it has noFacet: true", () => {
    const { result } = renderHook(() => useExplorerFacets())

    const properties = result.current.map((facet) => facet.property)
    expect(properties).not.toContain("last_updated")
  })
})
