import AnimatedList from "@components/common/AnimatedList"
import AnimatedListItem from "@components/common/AnimatedListItem"
import CodeBlock from "@components/common/CodeBlock"
import Panel, { PanelProps } from "@components/common/Panel"
import TaskAvatar from "@components/task/TaskAvatar"
import ReadMoreIcon from "@mui/icons-material/ReadMore"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Link from "@mui/material/Link"
import ListItemAvatar from "@mui/material/ListItemAvatar"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction"
import ListItemText from "@mui/material/ListItemText"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import { useStateStore } from "@stores/useStateStore"
import { format } from "date-fns"
import React, { useCallback } from "react"
import { Link as RouterLink } from "react-router-dom"

const RecentTaskListItem: React.FC<{ taskId: string }> = ({ taskId }) => {
    const task = useStateStore(useCallback((store) => store.tasks.get(taskId), [taskId]))
    return (
        <AnimatedListItem disablePadding>
            <ListItemButton component={RouterLink} to={`/tasks/${taskId}`}>
                <ListItemAvatar>
                    <TaskAvatar taskId={taskId} type={task?.type} status={task?.state} disableLink />
                </ListItemAvatar>
                <ListItemText
                    primary={task?.type || "Unknown"}
                    secondary={task?.sentAt && "Sent at " + format(task?.sentAt, "HH:mm:ss")}
                />
                <ListItemSecondaryAction>
                    <Tooltip title="View task...">
                        <ReadMoreIcon />
                    </Tooltip>
                </ListItemSecondaryAction>
            </ListItemButton>
        </AnimatedListItem>
    )
}

const RecentTasksPanel: React.FC<Omit<PanelProps, "title">> = (props) => {
    const recentTaskIds = useStateStore((state) => state.recentTaskIds)

    return (
        <Panel
            title="Recent Tasks"
            actions={
                <Button component={RouterLink} to="/explorer" variant="outlined" color="secondary">
                    View All
                </Button>
            }
            {...props}
        >
            {recentTaskIds.length ? (
                <AnimatedList>
                    {recentTaskIds.map((taskId, index) => (
                        <RecentTaskListItem key={index} taskId={taskId} />
                    ))}
                </AnimatedList>
            ) : (
                <Box textAlign="center" my={5}>
                    <Typography variant="h4" gutterBottom>
                        No recent tasks
                    </Typography>
                    <span>Make sure you have Celery Events enabled:</span>
                    <Box maxWidth="30em" mx="auto">
                        <CodeBlock language="python">
                            {[
                                'app = Celery("myapp")',
                                "app.conf.worker_send_task_events = True",
                                "app.conf.task_send_sent_event = True",
                                "app.conf.task_track_started = True",
                                "app.conf.result_extended = True",
                                "app.conf.enable_utc = True",
                            ].join("\n")}
                        </CodeBlock>
                    </Box>
                    <span>
                        For more information, see the{" "}
                        <Link
                            href="https://github.com/danyi1212/celery-insights?tab=readme-ov-file#enabling-celery-events"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Installation docs
                        </Link>
                        .
                    </span>
                </Box>
            )}
        </Panel>
    )
}
export default RecentTasksPanel
