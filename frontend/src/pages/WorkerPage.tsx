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
import React, { useCallback, useMemo } from "react"
import { useParams } from "react-router-dom"

const WorkerPage: React.FC = () => {
    const { workerId } = useParams() as { workerId: string }
    const hostname = useMemo(() => workerId.substring(0, workerId.lastIndexOf("-")), [workerId])
    const notFound = useStateStore(useCallback((state) => !state.workers.has(workerId), [workerId]))

    if (notFound)
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
                <WorkerDetailsCard workerId={workerId} hostname={hostname} />
            </Grid>
            <Grid item xs={12} lg={6} xl={4}>
                <BrokerDetailsCard hostname={hostname} />
            </Grid>
            <Grid item xs={12} lg={6} xl={4}>
                <PoolDetailsCard hostname={hostname} />
            </Grid>
            <Grid item xs={12}>
                <QueueDetails hostname={hostname} />
            </Grid>
            <Grid item xs={12} lg={6} xl={4}>
                <ActiveTasksPanel hostname={hostname} />
            </Grid>
            <Grid item xs={12} lg={6} xl={4}>
                <ReservedTasksPanel hostname={hostname} />
            </Grid>
            <Grid item xs={12} lg={6} xl={4}>
                <ScheduledTasksPanel hostname={hostname} />
            </Grid>
            <Grid item xs={12} xl={6}>
                <RegisteredTasksPanel workerId={workerId} hostname={hostname} />
            </Grid>
            <Grid item xs={12} xl={6}>
                <RevokedTasksPanel hostname={hostname} />
            </Grid>
        </Grid>
    )
}
export default WorkerPage
