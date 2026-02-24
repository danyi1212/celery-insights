import PanelPaper from "@components/common/PanelPaper"
import ErrorAlert from "@components/errors/ErrorAlert"
import { PaperProps, TypographyProps } from "@mui/material"
import Box from "@mui/material/Box"
import CircularProgress from "@mui/material/CircularProgress"
import Stack from "@mui/material/Stack"
import Toolbar from "@mui/material/Toolbar"
import Typography from "@mui/material/Typography"
import React, { useMemo } from "react"

export interface PanelProps extends PaperProps {
    title: string
    titleProps?: TypographyProps
    actions?: React.ReactNode
    children?: React.ReactNode
    loading?: boolean
    error?: unknown
}

const Panel: React.FC<PanelProps> = ({ title, children, actions, titleProps, loading, error, ...props }) => {
    const content = useMemo(() => {
        if (loading)
            return (
                <Box display="flex" justifyContent="center" alignItems="center" height="100%" width="100%">
                    <CircularProgress />
                </Box>
            )
        else if (error)
            return (
                <Box display="flex" justifyContent="center" alignItems="center" height="100%" width="100%">
                    <ErrorAlert error={error} />
                </Box>
            )
        else return children
    }, [loading, error, children])
    return (
        <Stack direction="column" height="100%">
            <Toolbar>
                <Typography variant="h4" {...titleProps} noWrap flexGrow={1}>
                    {title}
                </Typography>
                {actions}
            </Toolbar>
            <PanelPaper {...props}>{content}</PanelPaper>
        </Stack>
    )
}
export default Panel
