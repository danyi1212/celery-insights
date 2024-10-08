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
import { StateTask } from "@utils/translateServerModels"
import React, { useCallback, useState } from "react"

interface ExceptionTracebackProps extends AlertProps {
    exception: string
    traceback?: string | null
    currentTaskId?: string
}

const ExceptionTraceback: React.FC<ExceptionTracebackProps> = ({ exception, traceback, currentTaskId, ...props }) => {
    const [expanded, setExpanded] = useState(false)
    const theme = useTheme()
    const largeScreen = useMediaQuery(theme.breakpoints.up("sm"))
    const similarTasks = useStateStore(
        useCallback(
            (state) => {
                const similar: StateTask[] = []
                if (largeScreen)
                    state.tasks.forEach((task) => {
                        if (task.id !== currentTaskId && task.exception === exception) similar.push(task)
                    })
                return similar
            },
            [largeScreen, currentTaskId, exception],
        ),
    )
    const showSimilar = similarTasks.length > 0 && largeScreen

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
                    <Collapse in={expanded} unmountOnExit>
                        <CodeBlock language="python">{traceback}</CodeBlock>
                    </Collapse>
                </>
            )}
        </Alert>
    )
}

export default ExceptionTraceback
