import WorkerQuickStatus from "@components/worker/WorkerQuickStatus"
import { useOnlineWorkerIds } from "@hooks/worker/useOnlineWorkerIds"
import Divider from "@mui/material/Divider"
import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"
import React from "react"

const WorkerQuickStatusList: React.FC = () => {
    const workerIds = useOnlineWorkerIds()
    return (
        <Stack maxHeight="40vh" overflow="auto" rowGap={1}>
            <Typography variant="h6" align="center">
                Worker Status
            </Typography>
            <Divider />
            {workerIds.map((workerId) => (
                <WorkerQuickStatus key={workerId} workerId={workerId} />
            ))}
        </Stack>
    )
}

export default WorkerQuickStatusList
