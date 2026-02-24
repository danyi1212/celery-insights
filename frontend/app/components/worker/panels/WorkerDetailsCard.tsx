import CopyLinkButton from "@components/common/CopyLinkButton"
import DetailItem from "@components/common/DetailItem"
import LinearProgressWithLabel from "@components/common/LinearProgressWithLabel"
import Panel, { PanelProps } from "@components/common/Panel"
import WorkerStatus from "@components/worker/WorkerStatus"
import useWorkerStats from "@hooks/worker/useWorkerStats"
import { useStateStore } from "@stores/useStateStore"
import { formatBytes } from "@utils/FormatBytes"
import { formatSecondsDurationLong } from "@utils/FormatSecondsDurationLong"
import React, { useCallback } from "react"

interface WorkerDetailsCardProps extends Omit<PanelProps, "title"> {
    workerId: string
    hostname: string
}

const WorkerDetailsCard: React.FC<WorkerDetailsCardProps> = ({ workerId, hostname, ...props }) => {
    const worker = useStateStore(useCallback((state) => state.workers.get(workerId), [workerId]))
    const { stats, isLoading, error } = useWorkerStats(hostname)

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
                        value={<LinearProgressWithLabel value={worker?.cpuLoad?.[2] || 0} percentageLabel />}
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
                    <DetailItem label="Software Name" value={worker?.softwareIdentity} />
                </div>
                <div className="col-span-12 md:col-span-6">
                    <DetailItem label="Host OS" value={worker?.softwareSys} />
                </div>
                <div className="col-span-12 md:col-span-6">
                    <DetailItem label="Software Version" value={worker?.softwareVersion} />
                </div>
                <div className="col-span-12 md:col-span-6">
                    <DetailItem
                        label="Status"
                        description="Amount of time until the worker is considered offline"
                        color={worker?.heartbeatExpires && worker?.heartbeatExpires < new Date() ? "danger" : "primary"}
                        value={
                            <div>
                                <WorkerStatus heartbeatExpires={worker?.heartbeatExpires || new Date()} />
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
