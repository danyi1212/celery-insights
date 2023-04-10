import Panel from "@components/common/Panel"
import { useTheme } from "@mui/material"
import Typography from "@mui/material/Typography"
import { TaskResult } from "@services/server"
import { JsonViewer } from "@textea/json-viewer"
import React from "react"

interface ResultCardProps {
    result?: TaskResult
    loading: boolean
    error?: unknown
}

interface CardContentProps {
    result?: TaskResult
}

const CardContent: React.FC<CardContentProps> = ({ result }) => {
    const theme = useTheme()

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

const ResultCard: React.FC<ResultCardProps> = ({ result, loading, error }) => {
    return (
        <Panel title="Result" loading={loading} error={error}>
            <CardContent result={result} />
        </Panel>
    )
}

export default ResultCard
