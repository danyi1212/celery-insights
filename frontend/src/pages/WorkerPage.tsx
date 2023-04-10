import BrokerDetailsCard from "@components/worker/BrokerDetailsCard"
import PoolDetailsCard from "@components/worker/PoolDetailsCard"
import WorkerDetailsCard from "@components/worker/WorkerDetailsCard"
import Grid from "@mui/material/Grid"
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
        <Grid container spacing={3} px={3}>
            <Grid item xs={12} lg={6} xl={4}>
                <WorkerDetailsCard worker={worker} />
            </Grid>
            <Grid item xs={12} lg={6} xl={4}>
                <BrokerDetailsCard worker={worker} />
            </Grid>
            <Grid item xs={12} lg={6} xl={4}>
                <PoolDetailsCard worker={worker} />
            </Grid>
        </Grid>
    )
}
export default WorkerPage
