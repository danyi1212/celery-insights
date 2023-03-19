import LinearProgressWithLabel from "@components/common/LinearProgressWithLabel"
import Box from "@mui/material/Box"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import { Stats, Worker } from "@services/server"
import React from "react"

interface WorkerStatusProps {
    worker: Worker
    stats: Stats | undefined
}

const WorkerStatus: React.FC<WorkerStatusProps> = ({ worker, stats }) => {
    return (
        <Box m={1}>
            <Tooltip title={worker.hostname}>
                <Typography variant="subtitle2" mx={1} noWrap overflow="hidden">
                    {worker.hostname}
                </Typography>
            </Tooltip>
            <Tooltip title="Worker Utilization (Active Tasks / Max Concurrency)" placement="right" arrow>
                <div>
                    <LinearProgressWithLabel value={worker.active_tasks} max={stats?.pool["max-concurrency"] || 1} />
                </div>
            </Tooltip>
            <Tooltip title="CPU Utilization" placement="right" arrow>
                <div>
                    <LinearProgressWithLabel value={worker.cpu_load?.[0] || 0} percentageLabel />
                </div>
            </Tooltip>
        </Box>
    )
}
export default WorkerStatus
