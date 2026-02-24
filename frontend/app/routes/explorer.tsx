import { createFileRoute } from "@tanstack/react-router"
import CopyLinkButton from "@components/common/CopyLinkButton"
import ExplorerGrid from "@components/explorer/ExplorerGrid"
import FacetSet from "@components/explorer/FacetSet"
import { useExplorerFilter } from "@hooks/explorer/useExplorerFilter"
import { ExplorerLayout } from "@layout/explorer/ExplorerLayout"
import { useStateStore } from "@stores/useStateStore"
import { useTourChangeStepOnLoad } from "@stores/useTourStore"
import { StateTask } from "@utils/translateServerModels"

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
