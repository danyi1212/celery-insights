import DetailItem from "@components/common/detail-item"
import Panel, { PanelProps } from "@components/common/panel"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useWorkerStats } from "@hooks/worker/use-worker-inspect"
import { Lock, LockOpen } from "lucide-react"
import { formatSecondsDuration } from "@utils/format-seconds-duration"
import React from "react"

interface BrokerDetailsCardProps extends Omit<PanelProps, "title"> {
    workerId: string
}

const BrokerDetailsCard: React.FC<BrokerDetailsCardProps> = ({ workerId, ...props }) => {
    const { stats, isLoading, error } = useWorkerStats(workerId)
    return (
        <Panel title="Broker" loading={isLoading} error={error} {...props}>
            <div className="grid grid-cols-12 gap-2 p-2">
                <div className="col-span-12">
                    <DetailItem
                        label="Hostname"
                        value={
                            <div className="flex items-center">
                                {stats?.broker?.hostname}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        {stats?.broker?.ssl ? (
                                            <Lock className="mx-1 size-4 text-green-500" />
                                        ) : (
                                            <LockOpen className="mx-1 size-4 text-destructive" />
                                        )}
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {stats?.broker?.ssl ? "SSL Enabled" : "SSL Disabled"}
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        }
                    />
                </div>
                <div className="col-span-12 md:col-span-6">
                    <DetailItem label="Port" value={stats?.broker?.port} />
                </div>
                <div className="col-span-12 md:col-span-6">
                    <DetailItem label="Transport" value={stats?.broker?.transport} />
                </div>
                <div className="col-span-12 md:col-span-6">
                    <DetailItem label="User ID" value={stats?.broker?.userid} />
                </div>
                <div className="col-span-12 md:col-span-6">
                    <DetailItem label="Timeout" value={stats?.broker?.connection_timeout ?? "Unlimited"} />
                </div>
                <div className="col-span-12 md:col-span-6">
                    <DetailItem
                        label="Heartbeat Interval"
                        value={formatSecondsDuration(stats?.broker?.heartbeat || 0)}
                    />
                </div>
                <div className="col-span-12 md:col-span-6">
                    <DetailItem label="Login Method" value={stats?.broker?.login_method} />
                </div>
            </div>
        </Panel>
    )
}

export default BrokerDetailsCard
