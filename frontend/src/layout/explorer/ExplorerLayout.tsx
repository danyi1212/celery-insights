import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew"
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos"
import Box from "@mui/material/Box"
import Divider from "@mui/material/Divider"
import IconButton from "@mui/material/IconButton"
import Stack from "@mui/material/Stack"
import Toolbar from "@mui/material/Toolbar"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import React, { useState } from "react"

interface ExplorerLayoutProps {
    facets?: React.ReactNode
    actions?: React.ReactNode
    children?: React.ReactNode
}

const FACET_WIDTH = 300
export const ExplorerLayout: React.FC<ExplorerLayoutProps> = ({ facets, actions, children }) => {
    const [isFacetMenuOpen, setFacetMenuOpen] = useState(true)

    return (
        <Box display="flex" flexDirection="row">
            <Box
                width={isFacetMenuOpen ? FACET_WIDTH : 0}
                sx={{ transition: (theme) => theme.transitions.create("width"), overflow: "hidden" }}
            >
                <Toolbar>
                    <Typography variant="h5">Facets</Typography>
                </Toolbar>
                <Divider />
                {facets}
            </Box>
            <Box flexGrow={1}>
                <Toolbar>
                    <Tooltip title={isFacetMenuOpen ? "Hide facets" : "Show facets"}>
                        <IconButton onClick={() => setFacetMenuOpen(!isFacetMenuOpen)}>
                            {isFacetMenuOpen ? <ArrowBackIosNewIcon /> : <ArrowForwardIosIcon />}
                        </IconButton>
                    </Tooltip>
                    <Box flexGrow={1} />
                    <Stack
                        direction="row"
                        justifyContent="space-between"
                        spacing={1}
                        sx={{ justifyContent: "space-between", alignItems: "center" }}
                    >
                        {actions}
                    </Stack>
                </Toolbar>
                {children}
            </Box>
        </Box>
    )
}
