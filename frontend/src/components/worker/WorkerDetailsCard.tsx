import DetailItem from "@components/common/DetailItem"
import Panel from "@components/common/Panel"
import Grid from "@mui/material/Grid"
import { StateWorker } from "@utils/translateServerModels"
import React from "react"

interface WorkerDetailsCardProps {
    worker: StateWorker
}

const WorkerDetailsCard: React.FC<WorkerDetailsCardProps> = ({ worker }) => {
    return (
        <Panel title="Worker">
            <Grid container spacing={2} p={2}>
                <Grid item xs={12}>
                    <DetailItem label="Hostname" value={worker.hostname} />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem label="Process ID" value={worker.pid} />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem label="Software Name" value={worker.softwareIdentity} />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem label="Host OS" value={worker.softwareSys} />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem label="Software Version" value={worker.softwareVersion} />
                </Grid>
            </Grid>
        </Panel>
    )
}
export default WorkerDetailsCard
