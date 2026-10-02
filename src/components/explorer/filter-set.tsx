import FilterSection from "@components/explorer/filter-section"
import { useExplorerFilters } from "@stores/use-explorer-config"
import type { ExplorerFilters, FilterCounts } from "@hooks/use-explorer-tasks"
import React from "react"

interface FilterSetProps {
  availableFilters: FilterCounts
  filters: ExplorerFilters
  setFilter: (key: string, values: Set<string>) => void
}

const FILTER_KEY_TO_PARAM: Record<string, keyof ExplorerFilters> = {
  state: "states",
  type: "types",
  worker: "workers",
}

const FilterSet: React.FC<FilterSetProps> = ({ availableFilters, filters, setFilter }) => {
  const filterConfigs = useExplorerFilters()

  return (
    <>
      {filterConfigs.map((filterConfig) => {
        const key = filterConfig.property as string
        const filterKey = FILTER_KEY_TO_PARAM[key]
        const filterValues = filterKey ? (filters[filterKey] as string[] | undefined) : undefined
        const counts = availableFilters[key as keyof FilterCounts]

        return (
          <FilterSection
            key={key}
            title={filterConfig.label}
            valueFormatter={filterConfig.valueFormatter as (value: string) => React.ReactElement | string}
            counts={new Map(Object.entries(counts || {}))}
            selected={new Set(filterValues || [])}
            setSelected={(values) => setFilter(key, values)}
          />
        )
      })}
    </>
  )
}

export default FilterSet
