import LinearProgressWithLabel from "@components/common/LinearProgressWithLabel"
import PanelPaper from "@components/common/PanelPaper"
import TaskAvatar from "@components/task/TaskAvatar"
import AvatarGroup from "@mui/material/AvatarGroup"
import Button from "@mui/material/Button"
import Stack from "@mui/material/Stack"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import { TaskState } from "@services/server"
import { useStateStore } from "@stores/useStateStore"
import { StateWorker } from "@utils/translateServerModels"
import React, { useCallback, useMemo } from "react"
import { Link } from "react-router-dom"

interface WorkerSummaryProps {
    worker: StateWorker
}

const WorkerSummary: React.FC<WorkerSummaryProps> = ({ worker }) => {
    const tasks = useStateStore(
        useCallback(
            (store) =>
                store.tasks
                    .map((task) => task)
                    .filter((task) => task.worker === worker.id)
                    .sort((a, b) => (a.sentAt > b.sentAt ? -1 : 1)),
            [worker]
        )
    )
    const startedTasks = useMemo(() => tasks.filter((task) => task.state == TaskState.STARTED), [tasks])
    const receivedTasks = useMemo(() => tasks.filter((task) => task.state == TaskState.RECEIVED), [tasks])

    return (
        <PanelPaper sx={{ px: 2 }}>
            <Stack direction="row">
                <Tooltip title={worker.hostname}>
                    <Typography variant="h6" noWrap flexGrow={1}>
                        {worker.hostname}
                    </Typography>
                </Tooltip>
                <Button component={Link} to={`workers/${worker.id}`} variant="outlined" color="secondary">
                    View
                </Button>
            </Stack>
            <Tooltip title="CPU Utilization" placement="right" arrow>
                <div>
                    <LinearProgressWithLabel value={worker.cpuLoad?.[0] || 0} percentageLabel />
                </div>
            </Tooltip>
            <Typography align="right">Received</Typography>
            <AvatarGroup max={6} sx={{ minHeight: "44px" }}>
                {receivedTasks.map((task) => (
                    <TaskAvatar key={task.id} taskId={task.id} type={task.type} />
                ))}
            </AvatarGroup>
            <Typography align="right">Started</Typography>
            <AvatarGroup max={6} sx={{ minHeight: "44px" }}>
                {startedTasks.map((task) => (
                    <TaskAvatar key={task.id} taskId={task.id} type={task.type} />
                ))}
            </AvatarGroup>
        </PanelPaper>
    )
}
export default WorkerSummary
