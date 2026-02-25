import { createFileRoute } from "@tanstack/react-router"
import CopyLinkButton from "@components/common/copy-link-button"
import ExplorerGrid from "@components/explorer/explorer-grid"
import FacetSet from "@components/explorer/facet-set"
import { useExplorerFilter } from "@hooks/explorer/use-explorer-filter"
import { ExplorerLayout } from "@layout/explorer/explorer-layout"
import { useStateStore } from "@stores/use-state-store"
import { useTourChangeStepOnLoad } from "@stores/use-tour-store"
import { StateTask } from "@utils/translate-server-models"

const ExplorerPage = () => {
    const tasks = useStateStore((state) => {
        const tasks: StateTask[] = []
        state.tasks.forEach((task) => tasks.push(task))
        return tasks
    })
    const [filters, setFilter] = useExplorerFilter<StateTask>()
    useTourChangeStepOnLoad(11)

    return (
        <ExplorerLayout
            facets={
                <div id="facets-menu">
                    <FacetSet tasks={tasks} filters={filters} setFilter={setFilter} />
                </div>
            }
            actions={
                <>
                    <CopyLinkButton />
                    <span className="text-sm text-muted-foreground">{tasks.length} Tasks found</span>
                </>
            }
        >
            <ExplorerGrid tasks={tasks} filters={filters} />
        </ExplorerLayout>
    )
}

export const Route = createFileRoute("/explorer")({
    component: ExplorerPage,
})
