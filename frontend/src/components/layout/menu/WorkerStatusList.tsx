import WorkerStatus from "@components/layout/menu/WorkerStatus"
import Box from "@mui/material/Box"
import { ServerClient } from "@services/server"
import { useStateStore } from "@stores/useStateStore"
import React from "react"
import { useQuery } from "react-query"

const getWorkerStats = () => new ServerClient().workers.getWorkerStats()

const WorkerStatusList: React.FC = () => {
    const workersState = useStateStore((state) => state.workers)
    const { data } = useQuery("workers/stats", getWorkerStats)
    return (
        <Box display="flex" flexDirection="column">
            {Array.from(workersState.entries()).map(([workerId, worker]) => {
                const stats = data?.[worker.hostname]
                return <WorkerStatus key={workerId} worker={worker} stats={stats} />
            })}
        </Box>
    )
}

export default WorkerStatusList
