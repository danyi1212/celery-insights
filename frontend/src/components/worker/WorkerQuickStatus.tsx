import LinearProgressWithLabel from "@components/common/LinearProgressWithLabel"
import Box from "@mui/material/Box"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import { Stats } from "@services/server"
import { StateWorker } from "@utils/translateServerModels"
import React from "react"

interface WorkerQuickStatusProps {
    worker: StateWorker
    stats: Stats | undefined
}

const WorkerQuickStatus: React.FC<WorkerQuickStatusProps> = ({ worker, stats }) => {
    return (
        <Box m={1}>
            <Tooltip title={worker.hostname}>
                <Typography variant="subtitle2" mx={1} noWrap overflow="hidden">
                    {worker.hostname}
                </Typography>
            </Tooltip>
            <Tooltip title="Worker Utilization (Active Tasks / Max Concurrency)" placement="right" arrow>
                <div>
                    <LinearProgressWithLabel value={worker.activeTasks} max={stats?.pool["max-concurrency"] || 1} />
                </div>
            </Tooltip>
            <Tooltip title="CPU Utilization" placement="right" arrow>
                <div>
                    <LinearProgressWithLabel value={worker.cpuLoad?.[0] || 0} percentageLabel />
                </div>
            </Tooltip>
        </Box>
    )
}
export default WorkerQuickStatus
