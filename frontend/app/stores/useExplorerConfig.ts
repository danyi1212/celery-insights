import { StateTask } from "@utils/translateServerModels"
import { format } from "date-fns"
import React from "react"
import { create } from "zustand"

interface ColumnConfig<T, P extends keyof T> {
    property: P
    label: string
    columnWidth: number
    showColumn: boolean
    noFacet?: true
    showFacet?: boolean
    valueFormatter?: (value: T[P]) => React.ReactElement | string
}

type Configuration<T> = {
    [P in keyof Partial<T>]: ColumnConfig<T, P>
}

export interface ExplorerConfig {
    configs: Configuration<StateTask>
    columnOrder: (keyof StateTask)[]
    facetOrder: (keyof StateTask)[]
}

export const useExplorerConfig = create<ExplorerConfig>(() => ({
    columnOrder: ["lastUpdated", "state", "id", "type", "worker"],
    facetOrder: ["state", "type", "result", "worker"],
    configs: {
        lastUpdated: {
            property: "lastUpdated",
            label: "Last Updated",
            columnWidth: 160,
            showColumn: true,
            noFacet: true,
            valueFormatter: (value) => (value ? format(value, "MMM dd  hh:mm:ss.SSS") : "NaT"),
        },
        state: {
            property: "state",
            label: "Status",
            columnWidth: 100,
            showColumn: false,
            showFacet: true,
        },
        id: {
            property: "id",
            label: "Task ID",
            columnWidth: 100,
            showColumn: false,
        },
        type: {
            property: "type",
            label: "Type (name)",
            columnWidth: 300,
            showColumn: true,
            showFacet: true,
        },
        result: {
            property: "result",
            label: "Task Result",
            columnWidth: 100,
            showColumn: false,
            showFacet: true,
        },
        worker: {
            property: "worker",
            label: "Worker",
            columnWidth: 100,
            showColumn: false,
            showFacet: true,
        },
    },
}))

const removeUndefined = <T>(arr: (T | undefined)[]): T[] => arr.filter((item): item is T => item !== undefined)

export const useExplorerFacets = () =>
    useExplorerConfig((state) =>
        removeUndefined(state.facetOrder.map((facet) => state.configs[facet])).filter(
            (facetConfig) => !facetConfig.noFacet && facetConfig.showFacet,
        ),
    )

export const useExplorerColumns = () =>
    useExplorerConfig((state) =>
        removeUndefined(state.columnOrder.map((column) => state.configs[column])).filter(
            (columnConfig) => columnConfig.showColumn,
        ),
    )
