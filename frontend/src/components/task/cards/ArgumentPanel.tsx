import Panel from "@components/common/Panel"
import useTaskResult from "@hooks/task/useTaskResult"
import useTaskState from "@hooks/task/useTaskState"
import HelpOutlineIcon from "@mui/icons-material/HelpOutline"
import { PaperProps, useTheme } from "@mui/material"
import Box from "@mui/material/Box"
import IconButton from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import { JsonViewer } from "@textea/json-viewer"
import React from "react"

interface ArgumentPanelProps extends PaperProps {
    taskId: string
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

const ArgumentPanel: React.FC<ArgumentPanelProps> = ({ taskId, ...props }) => {
    const theme = useTheme()
    const { task } = useTaskState(taskId)
    const { taskResult, isLoading, error } = useTaskResult(taskId)
    const showHelp = !isLoading && (!taskResult?.args || !taskResult?.kwargs)
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
            loading={isLoading}
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
                        args: taskResult?.args || task?.args || "Unknown",
                        kwargs: taskResult?.kwargs || task?.kwargs || "Unknown",
                    }}
                />
            </Box>
        </Panel>
    )
}

export default ArgumentPanel
