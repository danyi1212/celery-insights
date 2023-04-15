import BrokerDetailsCard from "@components/worker/panels/BrokerDetailsCard"
import PoolDetailsCard from "@components/worker/panels/PoolDetailsCard"
import QueueDetails from "@components/worker/panels/QueueDetails"
import ActiveTasksPanel from "@components/worker/panels/tasks/ActiveTasksPanel"
import RegisteredTasksPanel from "@components/worker/panels/tasks/RegisteredTasksPanel"
import ReservedTasksPanel from "@components/worker/panels/tasks/ReservedTasksPanel"
import RevokedTasksPanel from "@components/worker/panels/tasks/RevokedTasksPanel"
import ScheduledTasksPanel from "@components/worker/panels/tasks/ScheduledTasksPanel"
import WorkerDetailsCard from "@components/worker/panels/WorkerDetailsCard"
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline"
import Box from "@mui/material/Box"
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
            <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" height="100%">
                <Box sx={{ display: "flex", alignItems: "center" }}>
                    <ErrorOutlineIcon sx={{ fontSize: (theme) => theme.typography.h3.fontSize }} color="warning" />
                    <Typography variant="h4" color="textPrimary" ml={2}>
                        Could not find worker {workerId}
                    </Typography>
                </Box>
            </Box>
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
            <Grid item xs={12}>
                <QueueDetails worker={worker} />
            </Grid>
            <Grid item xs={12} lg={6} xl={4}>
                <ActiveTasksPanel worker={worker} />
            </Grid>
            <Grid item xs={12} lg={6} xl={4}>
                <ReservedTasksPanel worker={worker} />
            </Grid>
            <Grid item xs={12} lg={6} xl={4}>
                <ScheduledTasksPanel worker={worker} />
            </Grid>
            <Grid item xs={12} xl={6}>
                <RegisteredTasksPanel worker={worker} />
            </Grid>
            <Grid item xs={12} xl={6}>
                <RevokedTasksPanel worker={worker} />
            </Grid>
        </Grid>
    )
}
export default WorkerPage
