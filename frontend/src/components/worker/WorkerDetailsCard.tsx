import DetailItem from "@components/common/DetailItem"
import LinearProgressWithLabel from "@components/common/LinearProgressWithLabel"
import Panel from "@components/common/Panel"
import WorkerStatus from "@components/worker/WorkerStatus"
import useWorkerState from "@hooks/useWorkerState"
import Grid from "@mui/material/Grid"
import { formatBytes } from "@utils/FormatBytes"
import { formatSecondsDuration } from "@utils/formatSecondsDuration"
import { StateWorker } from "@utils/translateServerModels"
import React from "react"

interface WorkerDetailsCardProps {
    worker: StateWorker
}

const WorkerDetailsCard: React.FC<WorkerDetailsCardProps> = ({ worker }) => {
    const { stats } = useWorkerState(worker)

    return (
        <Panel title="Worker">
            <Grid container spacing={2} p={2}>
                <Grid item xs={12}>
                    <DetailItem label="Hostname" value={worker.hostname} />
                </Grid>
                <Grid item xs={12}>
                    <DetailItem
                        label="CPU Usage"
                        description="Percentage of CPU used by worker process"
                        value={
                            <LinearProgressWithLabel
                                value={worker.cpuLoad?.[2] || 0}
                                buffer={worker.cpuLoad?.[0] || 0}
                                percentageLabel
                            />
                        }
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem
                        label="Uptime"
                        description="Amount of time the worker process has been running"
                        value={formatSecondsDuration(stats?.uptime || 0)}
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem
                        label="Memory"
                        description="Total memory usage by worker process"
                        value={formatBytes(stats?.rusage?.maxrss || 0)}
                    />
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
                <Grid item xs={12} md={6}>
                    <DetailItem
                        label="Status"
                        description="Amount of time until the worker is considered offline"
                        color={worker.heartbeatExpires && worker.heartbeatExpires < new Date() ? "danger" : "primary"}
                        value={
                            <div>
                                <WorkerStatus heartbeatExpires={worker.heartbeatExpires || new Date()} />
                            </div>
                        }
                    />
                </Grid>
            </Grid>
        </Panel>
    )
}
export default WorkerDetailsCard
