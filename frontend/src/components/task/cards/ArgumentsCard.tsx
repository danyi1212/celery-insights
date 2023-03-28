import HelpOutlineIcon from "@mui/icons-material/HelpOutline"
import { PaperProps, useTheme } from "@mui/material"
import Box from "@mui/material/Box"
import CircularProgress from "@mui/material/CircularProgress"
import IconButton from "@mui/material/IconButton"
import Paper from "@mui/material/Paper"
import Toolbar from "@mui/material/Toolbar"
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

const ArgumentsCard: React.FC<ArgumentsCardProps> = ({ task, result, loading, ...props }) => {
    const theme = useTheme()
    const showHelp = !loading && (!result?.args || !result?.kwargs)
    return (
        <Paper {...props}>
            <Toolbar>
                <Typography variant="h5">Arguments</Typography>
                <Box flexGrow={1} />
                {showHelp && (
                    <Tooltip title={<HelpMessage />}>
                        <IconButton>
                            <HelpOutlineIcon />
                        </IconButton>
                    </Tooltip>
                )}
            </Toolbar>
            <Box height="100%">
                {loading ? (
                    <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                        <CircularProgress />
                    </Box>
                ) : (
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
                )}
            </Box>
        </Paper>
    )
}

export default ArgumentsCard
