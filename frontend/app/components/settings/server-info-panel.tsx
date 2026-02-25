import DetailItem from "@components/common/detail-item"
import LinearProgressWithLabel from "@components/common/linear-progress-with-label"
import Panel from "@components/common/panel"
import VersionCheckIcon from "@components/settings/version-check-icon"
import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useClient } from "@hooks/use-client"
import { resetState } from "@stores/use-state-store"
import { useQuery } from "@tanstack/react-query"
import { formatBytes } from "@utils/format-bytes"
import { formatSecondsDurationLong } from "@utils/format-seconds-duration-long"
import { Loader2, RotateCw } from "lucide-react"
import React, { useCallback, useEffect, useState } from "react"

const LinkButton: React.FC<{ href: string; children?: React.ReactNode }> = ({ href, children }) => (
    <Button variant="outline" asChild disabled={Boolean(import.meta.env.VITE_DEMO_MODE)}>
        <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
        </a>
    </Button>
)

export const ServerInfoPanel: React.FC = () => {
    const client = useClient()
    const getServerInfo = useCallback(() => client.settings.getServerInfo(), [client])
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["server-info"],
        queryFn: getServerInfo,
    })

    const [isReset, setIsReset] = useState<boolean | null>(null)
    const [isResetLoading, setIsResetLoading] = useState(false)
    const handleResetState = () => {
        setIsResetLoading(true)
        client.settings
            .clearState(isReset === true)
            .then((res) => {
                setIsReset(res)
                if (res) {
                    resetState()
                    refetch().then()
                }
            })
            .catch(() => setIsReset(false))
            .finally(() => setIsResetLoading(false))
    }
    useEffect(() => {
        const token = setTimeout(() => setIsReset(null), 1000 * 10)
        return () => clearTimeout(token)
    }, [isReset])

    return (
        <Panel
            title="Server Info"
            loading={isLoading}
            error={error}
            actions={
                <>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                onClick={handleResetState}
                                disabled={isResetLoading}
                                className={isReset === false ? "border-destructive text-destructive" : ""}
                            >
                                {isResetLoading && <Loader2 className="size-4 animate-spin" />}
                                {isReset === null ? "Reset" : isReset ? "Force Reset" : "Error"}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {isReset ? "Clear all server state, including running tasks" : "Clear all server state"}
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => refetch().then()} disabled={isLoading}>
                                <RotateCw className="size-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Refresh Server Info</TooltipContent>
                    </Tooltip>
                </>
            }
        >
            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                <DetailItem label="Name" value={data?.server_name || "???"} />
                <DetailItem
                    label="Version"
                    value={
                        <span className="flex items-center">
                            {data?.server_version || "???"}
                            <VersionCheckIcon currentVersion={data?.server_version} />
                        </span>
                    }
                />
                <div className="md:col-span-2">
                    <DetailItem
                        label="CPU Usage"
                        description="CPU usage by the server process"
                        value={<LinearProgressWithLabel value={data?.cpu_usage[2] || 0} percentageLabel />}
                    />
                </div>
                <DetailItem
                    label="Memory"
                    description="Total memory usage by the server process"
                    value={formatBytes(data?.memory_usage || 0)}
                />
                <DetailItem
                    label="Uptime"
                    description="Amount of time the server process has been running"
                    value={formatSecondsDurationLong(data?.uptime || 0)}
                />
                <DetailItem label="Hostname" value={data?.server_hostname || "???"} />
                <DetailItem label="Port" value={data?.server_port || "???"} />
                <DetailItem label="Server OS" value={data?.server_os || "???"} />
                <DetailItem label="Python Version" value={data?.python_version || "???"} />
                <DetailItem
                    label="Tasks"
                    description="Number of tasks stored in state / limit"
                    value={`${data?.task_count || 0} / ${data?.tasks_max_count || "Unknown"}`}
                />
                <DetailItem
                    label="Workers"
                    description="Number of workers stored in state / limit"
                    value={`${data?.worker_count || 0} / ${data?.worker_max_count || "Unknown"}`}
                />
                <div className="flex justify-around gap-4 md:col-span-2">
                    <LinkButton href="/docs">API Explorer</LinkButton>
                    <LinkButton href="/redoc">API Docs</LinkButton>
                </div>
            </div>
        </Panel>
    )
}
