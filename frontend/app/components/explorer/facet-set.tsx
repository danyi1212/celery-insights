import Facet from "@components/explorer/facet"
import { useExplorerFacets } from "@stores/use-explorer-config"
import type { ExplorerFilters, FacetCounts } from "@hooks/use-explorer-tasks"
import React from "react"

interface FacetSetProps {
    facets: FacetCounts
    filters: ExplorerFilters
    setFilter: (key: string, values: Set<string>) => void
}

const FACET_KEY_TO_FILTER: Record<string, keyof ExplorerFilters> = {
    state: "states",
    type: "types",
    worker: "workers",
}

const FacetSet: React.FC<FacetSetProps> = ({ facets, filters, setFilter }) => {
    const facetConfigs = useExplorerFacets()

    return (
        <>
            {facetConfigs.map((facetConfig) => {
                const key = facetConfig.property as string
                const filterKey = FACET_KEY_TO_FILTER[key]
                const filterValues = filterKey ? (filters[filterKey] as string[] | undefined) : undefined
                const counts = facets[key as keyof FacetCounts]

                return (
                    <Facet
                        key={key}
                        title={facetConfig.label}
                        valueFormatter={facetConfig.valueFormatter as (value: string) => React.ReactElement | string}
                        counts={new Map(Object.entries(counts || {}))}
                        selected={new Set(filterValues || [])}
                        setSelected={(values) => setFilter(key, values)}
                    />
                )
            })}
        </>
    )
}

export default FacetSet
