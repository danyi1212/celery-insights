import CopyLinkButton from "@components/common/CopyLinkButton"
import ExplorerGrid from "@components/explorer/ExplorerGrid"
import FacetSet from "@components/explorer/FacetSet"
import { useExplorerFilter } from "@hooks/explorer/useExplorerFilter"
import { ExplorerLayout } from "@layout/explorer/ExplorerLayout"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import { useStateStore } from "@stores/useStateStore"
import { useTourChangeStepOnLoad } from "@stores/useTourStore"
import { StateTask } from "@utils/translateServerModels"
import React from "react"

const ExplorerPage: React.FC = () => {
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
                <Box id="facets-menu">
                    <FacetSet tasks={tasks} filters={filters} setFilter={setFilter} />
                </Box>
            }
            actions={
                <>
                    <CopyLinkButton />
                    <Typography variant="subtitle2">{tasks.length} Tasks found</Typography>
                </>
            }
        >
            <ExplorerGrid tasks={tasks} filters={filters} />
        </ExplorerLayout>
    )
}

export default ExplorerPage
