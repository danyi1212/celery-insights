import CopyLinkButton from "@components/common/CopyLinkButton"
import ExplorerGrid from "@components/explorer/ExplorerGrid"
import FacetSet from "@components/explorer/FacetSet"
import { useExplorerFilter } from "@hooks/explorer/useExplorerFilter"
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew"
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos"
import Box from "@mui/material/Box"
import Divider from "@mui/material/Divider"
import IconButton from "@mui/material/IconButton"
import Stack from "@mui/material/Stack"
import Toolbar from "@mui/material/Toolbar"
import Typography from "@mui/material/Typography"
import { useStateStore } from "@stores/useStateStore"
import { useTourChangeStepOnLoad } from "@stores/useTourStore"
import { StateTask } from "@utils/translateServerModels"
import React, { useState } from "react"

const FACET_WIDTH = 300
const ExplorerPage: React.FC = () => {
    const tasks = useStateStore((state) => state.tasks.map((task) => task))
    const [isFacetMenuOpen, setFacetMenuOpen] = useState(true)
    const [filters, setFilter] = useExplorerFilter<StateTask>()
    useTourChangeStepOnLoad(11)

    return (
        <Box>
            <Box display="flex" flexDirection="row">
                <Box
                    id="facets-menu"
                    width={isFacetMenuOpen ? FACET_WIDTH : 0}
                    sx={{ transition: (theme) => theme.transitions.create("width"), overflow: "hidden" }}
                >
                    <Toolbar>
                        <Typography variant="h5">Facets</Typography>
                    </Toolbar>
                    <Divider />
                    <FacetSet tasks={tasks} filters={filters} setFilter={setFilter} />
                </Box>
                <Box flexGrow={1}>
                    <Toolbar>
                        <IconButton onClick={() => setFacetMenuOpen(!isFacetMenuOpen)}>
                            {isFacetMenuOpen ? <ArrowBackIosNewIcon /> : <ArrowForwardIosIcon />}
                        </IconButton>
                        <Box flexGrow={1} />
                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            spacing={1}
                            sx={{ justifyContent: "space-between", alignItems: "center" }}
                        >
                            <CopyLinkButton />
                            <Typography variant="subtitle2">{tasks.length} Tasks found</Typography>
                        </Stack>
                    </Toolbar>
                    <ExplorerGrid tasks={tasks} filters={filters} />
                </Box>
            </Box>
        </Box>
    )
}

export default ExplorerPage
