import Facet from "@components/explorer/facet"
import { TaskFilter } from "@hooks/explorer/use-explorer-filter"
import { useExplorerFacets } from "@stores/use-explorer-config"
import { countUniqueProperties } from "@utils/count-unique-properties"
import { StateTask } from "@utils/translate-server-models"
import React, { useMemo } from "react"

interface FacetSetProps {
    tasks: StateTask[]
    filters: TaskFilter<StateTask>
    setFilter: (key: keyof StateTask, values: Set<string>) => void
}

const FacetSet: React.FC<FacetSetProps> = ({ tasks, filters, setFilter }) => {
    const facetConfigs = useExplorerFacets()
    const facetValues = useMemo(
        () =>
            countUniqueProperties(
                tasks,
                facetConfigs.map((facetConfig) => facetConfig.property),
            ),
        [tasks, facetConfigs],
    )

    return (
        <>
            {facetConfigs.map((facetConfig) => (
                <Facet
                    key={facetConfig.property}
                    title={facetConfig.label}
                    valueFormatter={facetConfig.valueFormatter as (value: string) => React.ReactElement | string}
                    counts={facetValues.get(facetConfig.property) || new Map()}
                    selected={filters.get(facetConfig.property) || new Set()}
                    setSelected={(values) => setFilter(facetConfig.property, values)}
                />
            ))}
        </>
    )
}

export default FacetSet
