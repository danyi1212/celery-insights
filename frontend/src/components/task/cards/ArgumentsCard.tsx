import Panel from "@components/common/Panel"
import HelpOutlineIcon from "@mui/icons-material/HelpOutline"
import { PaperProps, useTheme } from "@mui/material"
import Box from "@mui/material/Box"
import IconButton from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import { TaskResult } from "@services/server"
import { JsonViewer } from "@textea/json-viewer"
import { StateTask } from "@utils/translateServerModels"
import React from "react"

interface ArgumentsCardProps extends PaperProps {
    task: StateTask
    result?: TaskResult
    loading: boolean
    error?: unknown
}

const HelpMessage: React.FC = () => (
    <Typography variant="caption">
        Task arguments are shown as strings. <br />
        Enable{" "}
        <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://docs.celeryq.dev/en/stable/userguide/configuration.html#result-extended"
        >
            result_extend
        </a>{" "}
        in Celery config to view the complete arguments as objects.
    </Typography>
)

const ArgumentsCard: React.FC<ArgumentsCardProps> = ({ task, result, loading, error, ...props }) => {
    const theme = useTheme()
    const showHelp = !loading && (!result?.args || !result?.kwargs)
    return (
        <Panel
            title="Arguments"
            actions={
                showHelp && (
                    <Tooltip title={<HelpMessage />}>
                        <IconButton>
                            <HelpOutlineIcon />
                        </IconButton>
                    </Tooltip>
                )
            }
            loading={loading}
            error={error}
            {...props}
        >
            <Box height="100%">
                <JsonViewer
                    theme={theme.palette.mode}
                    editable={false}
                    rootName={false}
                    quotesOnKeys={false}
                    defaultInspectDepth={2}
                    value={{
                        args: result?.args || task.args,
                        kwargs: result?.kwargs || task.kwargs,
                    }}
                />
            </Box>
        </Panel>
    )
}

export default ArgumentsCard
