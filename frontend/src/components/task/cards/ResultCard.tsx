import Panel from "@components/common/Panel"
import { useTheme } from "@mui/material"
import Box from "@mui/material/Box"
import CircularProgress from "@mui/material/CircularProgress"
import Typography from "@mui/material/Typography"
import { TaskResult } from "@services/server"
import { JsonViewer } from "@textea/json-viewer"
import React from "react"

interface ResultCardProps {
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

const ResultCard: React.FC<ResultCardProps> = ({ result, loading }) => {
    return (
        <Panel title="Result">
            <CardContent result={result} loading={loading} />
        </Panel>
    )
}

export default ResultCard
