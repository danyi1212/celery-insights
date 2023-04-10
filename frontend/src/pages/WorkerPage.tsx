import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import { useStateStore } from "@stores/useStateStore"
import React, { useCallback } from "react"
import { useParams } from "react-router-dom"

const WorkerPage: React.FC = () => {
    const { workerId } = useParams() as { workerId: string }
    const worker = useStateStore(useCallback((state) => state.workers.get(workerId), [workerId]))

    if (worker === undefined)
        return (
            <Typography variant="h3" align="center" m={5}>
                Worker {workerId} is not found.
            </Typography>
        )

    return (
        <Box>
            <Typography variant="h4" align="center">
                {worker.hostname}
            </Typography>
        </Box>
    )
}
export default WorkerPage
