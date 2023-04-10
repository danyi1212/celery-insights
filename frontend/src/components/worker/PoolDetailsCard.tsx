import DetailItem from "@components/common/DetailItem"
import Panel from "@components/common/Panel"
import useWorkerState from "@hooks/useWorkerState"
import Grid from "@mui/material/Grid"
import { formatSecondsDuration } from "@utils/formatSecondsDuration"
import { StateWorker } from "@utils/translateServerModels"
import React from "react"

interface PoolDetailsCardProps {
    worker: StateWorker
}

const PoolDetailsCard: React.FC<PoolDetailsCardProps> = ({ worker }) => {
    const { stats } = useWorkerState(worker)
    return (
        <Panel title="Process Pool">
            <Grid container spacing={2} p={2}>
                <Grid item xs={12} md={6}>
                    <DetailItem
                        label="Max Concurrency"
                        description="Maximum number of child parallelism (processes/threads)"
                        value={stats?.pool["max-concurrency"]}
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem
                        label="Recycle Limit"
                        description="Maximum number of tasks to be executed before child recycled"
                        value={stats?.pool["max-tasks-per-child"]}
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem label="Soft Timeout" value={formatSecondsDuration(stats?.pool.timeouts[0] || 0)} />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem label="Hard Timeout" value={formatSecondsDuration(stats?.pool.timeouts[1] || 0)} />
                </Grid>
            </Grid>
        </Panel>
    )
}

export default PoolDetailsCard
