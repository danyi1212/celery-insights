import ExplorerGrid from "@components/explorer/ExplorerGrid"
import Facet from "@components/explorer/Facet"
import { useExplorerFilter } from "@hooks/useExplorerFilter"
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew"
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos"
import Box from "@mui/material/Box"
import Divider from "@mui/material/Divider"
import IconButton from "@mui/material/IconButton"
import TextField from "@mui/material/TextField"
import Toolbar from "@mui/material/Toolbar"
import Typography from "@mui/material/Typography"
import { useStateStore } from "@stores/useStateStore"
import { countUniqueProperties } from "@utils/CountUniqueProperties"
import React, { useMemo, useState } from "react"

const ExplorerPage: React.FC = () => {
    const tasks = useStateStore((state) => state.tasks.map((_, task) => task))
    const [isFacetOpen, setFacetOpen] = useState(true)
    const facetValues = useMemo(() => countUniqueProperties(tasks, ["state", "type", "result", "worker"]), [tasks])
    const [filters, setFilter] = useExplorerFilter()

    return (
        <Box>
            <Box mt={5}>
                <TextField label="Filter" variant="outlined" fullWidth />
            </Box>
            <Box display="flex" flexDirection="row">
                <Box
                    width={isFacetOpen ? 250 : 0}
                    sx={{ transition: (theme) => theme.transitions.create("width"), overflow: "hidden" }}
                >
                    <Typography variant="h5" my={1} mx={2}>
                        Facets
                    </Typography>
                    <Divider />
                    {Array.from(facetValues.entries()).map(([facetName, values]) => (
                        <Facet
                            key={facetName}
                            title={facetName}
                            counts={values}
                            selected={filters.get(facetName) || new Set()}
                            setSelected={(values) => setFilter(facetName, values)}
                        />
                    ))}
                </Box>
                <Box flexGrow={1}>
                    <Toolbar>
                        <IconButton onClick={() => setFacetOpen(!isFacetOpen)}>
                            {isFacetOpen ? <ArrowBackIosNewIcon /> : <ArrowForwardIosIcon />}
                        </IconButton>
                        <Box flexGrow={1} />
                        <Typography variant="subtitle2">{tasks.length} Tasks found</Typography>
                    </Toolbar>
                    <ExplorerGrid tasks={tasks} />
                </Box>
            </Box>
        </Box>
    )
}

export default ExplorerPage
