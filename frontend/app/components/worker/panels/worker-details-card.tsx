import CopyLinkButton from "@components/common/copy-link-button"
import DetailItem from "@components/common/detail-item"
import LinearProgressWithLabel from "@components/common/linear-progress-with-label"
import Panel, { PanelProps } from "@components/common/panel"
import WorkerStatus from "@components/worker/worker-status"
import useWorkerStats from "@hooks/worker/use-worker-stats"
import { useWorker } from "@hooks/use-live-workers"
import { formatBytes } from "@utils/format-bytes"
import { formatSecondsDurationLong } from "@utils/format-seconds-duration-long"
import React from "react"

interface WorkerDetailsCardProps extends Omit<PanelProps, "title"> {
    workerId: string
    hostname: string
}

const WorkerDetailsCard: React.FC<WorkerDetailsCardProps> = ({ workerId, hostname, ...props }) => {
    const { worker } = useWorker(workerId)
    const { stats, isLoading, error } = useWorkerStats(hostname)

    const heartbeatExpires = worker?.heartbeat_expires ? new Date(worker.heartbeat_expires) : undefined

    return (
        <Panel title="Worker" loading={isLoading} error={error} actions={<CopyLinkButton />} {...props}>
            <div className="grid grid-cols-12 gap-2 p-2">
                <div className="col-span-12">
                    <DetailItem label="Hostname" value={worker?.hostname} />
                </div>
                <div className="col-span-12">
                    <DetailItem
                        label="CPU Usage"
                        description="Percentage of CPU used by worker process"
                        value={<LinearProgressWithLabel value={worker?.cpu_load?.[2] || 0} percentageLabel />}
                    />
                </div>
                <div className="col-span-12 md:col-span-6">
                    <DetailItem
                        label="Uptime"
                        description="Amount of time the worker process has been running"
                        value={formatSecondsDurationLong(stats?.uptime || 0)}
                    />
                </div>
                <div className="col-span-12 md:col-span-6">
                    <DetailItem
                        label="Memory"
                        description="Total memory usage by worker process"
                        value={formatBytes(stats?.rusage?.maxrss || 0)}
                    />
                </div>
                <div className="col-span-12 md:col-span-6">
                    <DetailItem label="Process ID" value={worker?.pid} />
                </div>
                <div className="col-span-12 md:col-span-6">
                    <DetailItem label="Software Name" value={worker?.software_identity} />
                </div>
                <div className="col-span-12 md:col-span-6">
                    <DetailItem label="Host OS" value={worker?.software_sys} />
                </div>
                <div className="col-span-12 md:col-span-6">
                    <DetailItem label="Software Version" value={worker?.software_version} />
                </div>
                <div className="col-span-12 md:col-span-6">
                    <DetailItem
                        label="Status"
                        description="Amount of time until the worker is considered offline"
                        color={heartbeatExpires && heartbeatExpires < new Date() ? "danger" : "primary"}
                        value={
                            <div>
                                <WorkerStatus heartbeatExpires={heartbeatExpires || new Date()} />
                            </div>
                        }
                    />
                </div>
                <div className="col-span-12 md:col-span-6">
                    <DetailItem
                        label="Processed"
                        description="Number of tasks processed"
                        value={Object.values(stats?.total || {}).reduce((acc, curr) => acc + curr, 0)}
                    />
                </div>
            </div>
        </Panel>
    )
}
export default WorkerDetailsCard
