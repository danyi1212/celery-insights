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
import { StateTask } from "@utils/translateServerModels"
import React, { useCallback, useMemo } from "react"
import { Link } from "react-router-dom"

interface WorkerSummaryProps {
    workerId: string
}

const WorkerSummary: React.FC<WorkerSummaryProps> = ({ workerId }) => {
    const worker = useStateStore((state) => state.workers.get(workerId))
    const tasks = useStateStore(
        useCallback(
            (store) => {
                const related: StateTask[] = []
                store.tasks.forEach((task) => {
                    if (task.worker === workerId) related.push(task)
                })
                return related.sort((a, b) => (a.sentAt > b.sentAt ? -1 : 1))
            },
            [workerId]
        )
    )
    const startedTasks = useMemo(() => tasks.filter((task) => task.state == TaskState.STARTED), [tasks])
    const receivedTasks = useMemo(() => tasks.filter((task) => task.state == TaskState.RECEIVED), [tasks])

    if (worker === undefined) return <></>

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
                    <LinearProgressWithLabel
                        value={worker?.cpuLoad?.[2] || 0}
                        buffer={worker?.cpuLoad?.[0] || 0}
                        percentageLabel
                    />
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
