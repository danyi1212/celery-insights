import ErrorAlert from "@components/errors/ErrorAlert"
import QueueDetailsPanel from "@components/worker/panels/QueueDetailsPanel"
import useWorkerQueues from "@hooks/useWorkerQueues"
import Box from "@mui/material/Box"
import CircularProgress from "@mui/material/CircularProgress"
import Grid from "@mui/material/Grid"
import Typography from "@mui/material/Typography"
import { StateWorker } from "@utils/translateServerModels"
import React from "react"

interface QueueDetailsProps {
    worker: StateWorker
}

const QueueDetails: React.FC<QueueDetailsProps> = ({ worker }) => {
    const { queues, isLoading, error } = useWorkerQueues(worker)
    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100%" width="100%">
                <CircularProgress />
            </Box>
        )
    }
    if (error) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100%" width="100%">
                <ErrorAlert error={error} />
            </Box>
        )
    }
    if (!queues || !queues.length) {
        return (
            <Typography variant="h3" align="center" p={3}>
                No Queues Connected
            </Typography>
        )
    }
    return (
        <Grid container spacing={3} px={3}>
            {queues.map((queue) => (
                <Grid item xs={12} sm={6} lg={4} xl={3} key={queue.name}>
                    <QueueDetailsPanel queue={queue} />
                </Grid>
            ))}
        </Grid>
    )
}

export default QueueDetails
