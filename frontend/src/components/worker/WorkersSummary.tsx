import WorkerPanel from "@components/worker/WorkerPanel"
import Grid from "@mui/material/Grid"
import { useStateStore } from "@stores/useStateStore"
import React, { useMemo } from "react"

const WorkersSummary: React.FC = () => {
    const workers = useStateStore((state) =>
        state.workers
            .map((worker) => worker)
            .filter((worker) => worker.heartbeatExpires && worker.heartbeatExpires > new Date())
    )
    const isEven = useMemo(() => workers.length % 2 === 0, [workers])

    return (
        <Grid container spacing={3} p={3} justifyContent="space-evenly">
            {workers.map((worker) => (
                <Grid key={worker.id} item xs={12} sm={6} lg={isEven ? 3 : 4} xl={isEven ? 3 : 2}>
                    <WorkerPanel worker={worker} />
                </Grid>
            ))}
        </Grid>
    )
}
export default WorkersSummary
