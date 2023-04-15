import CodeBlock from "@components/common/CodeBlock"
import TaskAvatar from "@components/task/TaskAvatar"
import ExpandLessIcon from "@mui/icons-material/ExpandLess"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import { useTheme } from "@mui/material"
import Alert, { AlertProps } from "@mui/material/Alert"
import AlertTitle from "@mui/material/AlertTitle"
import AvatarGroup from "@mui/material/AvatarGroup"
import Button from "@mui/material/Button"
import Collapse from "@mui/material/Collapse"
import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"
import useMediaQuery from "@mui/material/useMediaQuery"
import { useStateStore } from "@stores/useStateStore"
import React, { useCallback, useState } from "react"

interface ExceptionTracebackProps extends AlertProps {
    exception: string
    traceback?: string
    currentTaskId?: string
}

const ExceptionTraceback: React.FC<ExceptionTracebackProps> = ({ exception, traceback, currentTaskId, ...props }) => {
    const [expanded, setExpanded] = useState(false)
    const theme = useTheme()
    const largeScreem = useMediaQuery(theme.breakpoints.up("sm"))
    const similarTasks = useStateStore(
        useCallback(
            (state) =>
                largeScreem
                    ? state.tasks
                          .map((task) => task)
                          .filter((task) => task.id !== currentTaskId && task.exception === exception)
                    : [],
            [largeScreem, exception, currentTaskId]
        )
    )
    const showSimilar = similarTasks.length > 0 && largeScreem

    return (
        <Alert
            severity="error"
            {...props}
            sx={{ ...props.sx, ".MuiAlert-message": { flexGrow: 1, pt: showSimilar ? 0 : 1 } }}
        >
            <AlertTitle sx={{ display: "flex", alignItems: "center", flexGrow: 1 }}>
                <Typography flexGrow={1}>Failed Task</Typography>
                <Collapse in={showSimilar} orientation="horizontal">
                    <Stack direction="row" alignItems="center" spacing={2}>
                        <Typography>Similar:</Typography>
                        <AvatarGroup>
                            {similarTasks.map((task) => (
                                <TaskAvatar key={task.id} taskId={task.id} type={task.type} />
                            ))}
                        </AvatarGroup>
                    </Stack>
                </Collapse>
            </AlertTitle>
            <Typography py={1}>{exception}</Typography>
            {traceback && (
                <>
                    <Button
                        color="inherit"
                        onClick={() => setExpanded((expended) => !expended)}
                        startIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    >
                        Traceback
                    </Button>
                    <Collapse in={expanded}>
                        <CodeBlock language="python" code={traceback} />
                    </Collapse>
                </>
            )}
        </Alert>
    )
}

export default ExceptionTraceback
