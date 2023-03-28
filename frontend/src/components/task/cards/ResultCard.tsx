import { PaperProps, useTheme } from "@mui/material"
import Box from "@mui/material/Box"
import CircularProgress from "@mui/material/CircularProgress"
import Paper from "@mui/material/Paper"
import Toolbar from "@mui/material/Toolbar"
import Typography from "@mui/material/Typography"
import { TaskResult } from "@services/server"
import { JsonViewer } from "@textea/json-viewer"
import React from "react"

interface ResultCardProps extends PaperProps {
    result?: TaskResult
    loading: boolean
}

interface CardContentProps {
    result?: TaskResult
    loading: boolean
}

const CardContent: React.FC<CardContentProps> = ({ result, loading }) => {
    const theme = useTheme()

    if (loading)
        return (
            <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                <CircularProgress />
            </Box>
        )

    if (!result) return <Typography>Could not find task result.</Typography>

    if (result.ignored)
        return (
            <Typography>
                Task is configured to{" "}
                <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href="https://docs.celeryq.dev/en/stable/userguide/tasks.html#Task.ignore_result"
                >
                    ignore result
                </a>
                .
            </Typography>
        )

    return (
        <JsonViewer
            theme={theme.palette.mode}
            editable={false}
            rootName={false}
            quotesOnKeys={false}
            defaultInspectDepth={2}
            value={result.result}
        />
    )
}

const ResultCard: React.FC<ResultCardProps> = ({ result, loading, ...props }) => {
    return (
        <Paper {...props}>
            <Toolbar>
                <Typography variant="h5">Result</Typography>
            </Toolbar>
            <Box height="100%">
                <CardContent result={result} loading={loading} />
            </Box>
        </Paper>
    )
}

export default ResultCard
