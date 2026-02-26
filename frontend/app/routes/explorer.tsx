import { createFileRoute } from "@tanstack/react-router"
import CopyLinkButton from "@components/common/copy-link-button"
import ExportButton from "@components/explorer/export-button"
import ExplorerGrid from "@components/explorer/explorer-grid"
import FacetSet from "@components/explorer/facet-set"
import { useExplorerTasks, type ExplorerFilters, type SortConfig } from "@hooks/use-explorer-tasks"
import { ExplorerLayout } from "@layout/explorer/explorer-layout"
import { useTourChangeStepOnLoad } from "@stores/use-tour-store"
import { useCallback, useState } from "react"

const ExplorerPage = () => {
    const [filters, setFilters] = useState<ExplorerFilters>({})
    const [sort, setSort] = useState<SortConfig>({ field: "last_updated", direction: "DESC" })
    const [page, setPage] = useState(1)
    const pageSize = 50

    const { data: tasks, total, facets } = useExplorerTasks(filters, sort, page, pageSize)

    const setFilter = useCallback((key: string, values: Set<string>) => {
        setFilters((prev) => {
            const arrKey = key === "state" ? "states" : key === "type" ? "types" : "workers"
            return { ...prev, [arrKey]: values.size > 0 ? [...values] : undefined }
        })
        setPage(1)
    }, [])

    useTourChangeStepOnLoad(11)

    return (
        <ExplorerLayout
            facets={
                <div id="facets-menu">
                    <FacetSet facets={facets} filters={filters} setFilter={setFilter} />
                </div>
            }
            actions={
                <>
                    <ExportButton filters={filters} sort={sort} total={total} />
                    <CopyLinkButton />
                    <span className="text-sm text-muted-foreground">{total} Tasks found</span>
                </>
            }
        >
            <ExplorerGrid
                tasks={tasks}
                sort={sort}
                setSort={setSort}
                page={page}
                setPage={setPage}
                pageSize={pageSize}
                total={total}
            />
        </ExplorerLayout>
    )
}

export const Route = createFileRoute("/explorer")({
    component: ExplorerPage,
})
