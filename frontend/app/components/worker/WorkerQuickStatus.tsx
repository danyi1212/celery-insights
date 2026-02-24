import LinearProgressWithLabel from "@components/common/LinearProgressWithLabel"
import Box from "@mui/material/Box"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import { useStateStore } from "@stores/useStateStore"
import React from "react"

interface WorkerQuickStatusProps {
    workerId: string
}

const WorkerQuickStatus: React.FC<WorkerQuickStatusProps> = ({ workerId }) => {
    const worker = useStateStore((state) => state.workers.get(workerId))
    if (worker === undefined) return <></>
    return (
        <Box m={1}>
            <Tooltip title={worker.hostname}>
                <Typography variant="subtitle2" mx={1} noWrap overflow="hidden">
                    {worker.hostname}
                </Typography>
            </Tooltip>
            <Tooltip title="CPU Utilization" placement="right" arrow>
                <div>
                    <LinearProgressWithLabel
                        value={worker.cpuLoad?.[2] || 0}
                        buffer={worker.cpuLoad?.[0] || 0}
                        percentageLabel
                    />
                </div>
            </Tooltip>
        </Box>
    )
}
export default WorkerQuickStatus
