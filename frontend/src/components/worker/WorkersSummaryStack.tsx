import WorkerSummary from "@components/worker/WorkerSummary"
import { useOnlineWorkerIds } from "@hooks/worker/useOnlineWorkerIds"
import Box from "@mui/material/Box"
import Stack from "@mui/material/Stack"
import Toolbar from "@mui/material/Toolbar"
import Typography from "@mui/material/Typography"
import React from "react"

const WorkersSummaryStack: React.FC = () => {
    const workerIds = useOnlineWorkerIds()

    return (
        <Box>
            <Toolbar>
                <Typography variant="h4" noWrap>
                    Online Workers
                </Typography>
            </Toolbar>
            {workerIds.length ? (
                <Stack spacing={5}>
                    {workerIds.map((workerId) => (
                        <WorkerSummary key={workerId} workerId={workerId} />
                    ))}
                </Stack>
            ) : (
                <Typography variant="h4" align="center" my={5}>
                    No online workers
                </Typography>
            )}
        </Box>
    )
}
export default WorkersSummaryStack
