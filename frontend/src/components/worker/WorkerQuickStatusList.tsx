import WorkerQuickStatus from "@components/worker/WorkerQuickStatus"
import { useOnlineWorkers } from "@hooks/worker/useOnlineWorkers"
import Divider from "@mui/material/Divider"
import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"
import { ServerClient } from "@services/server"
import React from "react"
import { useQuery } from "react-query"

const getWorkerStats = () => new ServerClient().workers.getWorkerStats()

const WorkerQuickStatusList: React.FC = () => {
    const workersState = useOnlineWorkers()
    const { data } = useQuery("workers/stats", getWorkerStats)
    return (
        <Stack maxHeight="40vh" overflow="auto" rowGap={1}>
            <Typography variant="h6" align="center">
                Worker Status
            </Typography>
            <Divider />
            {workersState.map((worker) => (
                <WorkerQuickStatus key={worker.id} worker={worker} stats={data?.[worker.hostname]} />
            ))}
        </Stack>
    )
}

export default WorkerQuickStatusList
