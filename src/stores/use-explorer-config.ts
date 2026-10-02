import type { Task } from "@/types/surreal-records"
import { format } from "date-fns"
import React from "react"
import { create } from "zustand"
import { useShallow } from "zustand/shallow"

interface ColumnConfig<T, P extends keyof T> {
  property: P
  label: string
  columnWidth: number
  showColumn: boolean
  noFilter?: true
  showFilter?: boolean
  valueFormatter?: (value: T[P]) => React.ReactElement | string
}

type Configuration<T> = {
  [P in keyof Partial<T>]: ColumnConfig<T, P>
}

const formatDateValue = (value: unknown): string => {
  if (!value) return "NaT"
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? "NaT" : format(date, "MMM dd  hh:mm:ss.SSS")
}

export interface ExplorerConfig {
  configs: Configuration<Task>
  columnOrder: (keyof Task)[]
  filterOrder: (keyof Task)[]
}

export const useExplorerConfig = create<ExplorerConfig>(() => ({
  columnOrder: ["last_updated", "state", "id", "type", "worker"],
  filterOrder: ["state", "type", "result", "worker"],
  configs: {
    last_updated: {
      property: "last_updated",
      label: "Last Updated",
      columnWidth: 160,
      showColumn: true,
      noFilter: true,
      valueFormatter: (value) => formatDateValue(value),
    },
    state: {
      property: "state",
      label: "Status",
      columnWidth: 100,
      showColumn: false,
      showFilter: true,
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
      showFilter: true,
    },
    result: {
      property: "result",
      label: "Task Result",
      columnWidth: 100,
      showColumn: false,
      showFilter: true,
    },
    worker: {
      property: "worker",
      label: "Worker",
      columnWidth: 100,
      showColumn: false,
      showFilter: true,
    },
  },
}))

const removeUndefined = <T>(arr: (T | undefined)[]): T[] => arr.filter((item): item is T => item !== undefined)

export const useExplorerFilters = () =>
  useExplorerConfig(
    useShallow((state) =>
      removeUndefined(state.filterOrder.map((filterKey) => state.configs[filterKey])).filter(
        (filterConfig) => !filterConfig.noFilter && filterConfig.showFilter,
      ),
    ),
  )

export const useExplorerColumns = () =>
  useExplorerConfig(
    useShallow((state) =>
      removeUndefined(state.columnOrder.map((column) => state.configs[column])).filter(
        (columnConfig) => columnConfig.showColumn,
      ),
    ),
  )
