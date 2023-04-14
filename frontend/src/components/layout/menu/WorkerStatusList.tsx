import WorkerStatus from "@components/layout/menu/WorkerStatus"
import Divider from "@mui/material/Divider"
import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"
import { ServerClient } from "@services/server"
import { useStateStore } from "@stores/useStateStore"
import React from "react"
import { useQuery } from "react-query"

const getWorkerStats = () => new ServerClient().workers.getWorkerStats()

const WorkerStatusList: React.FC = () => {
    const workersState = useStateStore((state) =>
        state.workers
            .map((worker) => worker)
            .filter((worker) => worker.heartbeatExpires && worker.heartbeatExpires > new Date())
    )
    const { data } = useQuery("workers/stats", getWorkerStats)
    return (
        <Stack maxHeight="40vh" overflow="auto" rowGap={1}>
            <Typography variant="h6" align="center">
                Worker Status
            </Typography>
            <Divider />
            {workersState.map((worker) => {
                const stats = data?.[worker.hostname]
                return <WorkerStatus key={worker.id} worker={worker} stats={stats} />
            })}
        </Stack>
    )
}

export default WorkerStatusList
