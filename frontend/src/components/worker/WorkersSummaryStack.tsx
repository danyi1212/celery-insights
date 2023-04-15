import WorkerSummary from "@components/worker/WorkerSummary"
import { useOnlineWorkers } from "@hooks/worker/useOnlineWorkers"
import Box from "@mui/material/Box"
import Stack from "@mui/material/Stack"
import Toolbar from "@mui/material/Toolbar"
import Typography from "@mui/material/Typography"
import React from "react"

const WorkersSummaryStack: React.FC = () => {
    const workers = useOnlineWorkers()

    return (
        <Box>
            <Toolbar>
                <Typography variant="h4" noWrap>
                    Online Workers
                </Typography>
            </Toolbar>
            <Stack spacing={5}>
                {workers.map((worker) => (
                    <WorkerSummary key={worker.id} worker={worker} />
                ))}
            </Stack>
        </Box>
    )
}
export default WorkersSummaryStack
