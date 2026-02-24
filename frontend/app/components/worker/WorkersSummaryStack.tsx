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
                <Box textAlign="center" my={5}>
                    <Typography variant="h4" gutterBottom>
                        No online workers
                    </Typography>
                    <span>Start a Celery worker to see it here</span>
                </Box>
            )}
        </Box>
    )
}
export default WorkersSummaryStack
