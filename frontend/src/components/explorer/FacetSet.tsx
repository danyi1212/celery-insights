import Facet from "@components/explorer/Facet"
import { useExplorerFilter } from "@hooks/useExplorerFilter"
import { useExplorerFacets } from "@stores/useExplorerConfig"
import { countUniqueProperties } from "@utils/CountUniqueProperties"
import { StateTask } from "@utils/translateServerModels"
import React, { useMemo } from "react"

interface FacetSetProps {
    tasks: StateTask[]
    filterState: ReturnType<typeof useExplorerFilter>
}

const FacetSet: React.FC<FacetSetProps> = ({ tasks, filterState }) => {
    const [filters, setFilter] = filterState
    const facetConfigs = useExplorerFacets()
    const facetValues = useMemo(
        () =>
            countUniqueProperties(
                tasks,
                facetConfigs.map((facetConfig) => facetConfig.property)
            ),
        [tasks, facetConfigs]
    )

    return (
        <>
            {facetConfigs.map((facetConfig) => (
                <Facet
                    key={facetConfig.property}
                    title={facetConfig.label}
                    counts={facetValues.get(facetConfig.property) || new Map()}
                    selected={filters.get(facetConfig.property) || new Set()}
                    setSelected={(values) => setFilter(facetConfig.property, values)}
                />
            ))}
        </>
    )
}

export default FacetSet
