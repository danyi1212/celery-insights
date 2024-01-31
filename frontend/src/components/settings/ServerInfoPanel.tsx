import DetailItem from "@components/common/DetailItem"
import LinearProgressWithLabel from "@components/common/LinearProgressWithLabel"
import Panel from "@components/common/Panel"
import VersionCheckIcon from "@components/settings/VersionCheckIcon"
import { useClient } from "@hooks/useClient"
import RefreshIcon from "@mui/icons-material/Refresh"
import LoadingButton from "@mui/lab/LoadingButton"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Grid from "@mui/material/Grid"
import IconButton from "@mui/material/IconButton"
import Stack from "@mui/material/Stack"
import Tooltip from "@mui/material/Tooltip"
import { resetState } from "@stores/useStateStore"
import { useQuery } from "@tanstack/react-query"
import { formatBytes } from "@utils/FormatBytes"
import { formatSecondsDurationLong } from "@utils/FormatSecondsDurationLong"
import React, { useCallback, useEffect, useState } from "react"

interface LinkButtonProps {
    href: string
    children?: React.ReactNode
}

const LinkButton: React.FC<LinkButtonProps> = ({ href, children }) => (
    <Button
        component="a"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        variant="outlined"
        color="secondary"
        disabled={Boolean(import.meta.env.VITE_DEMO_MODE)}
    >
        {children}
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
                    <Tooltip
                        title={isReset ? "Clear all server state, including running tasks" : "Clear all server state"}
                    >
                        <LoadingButton
                            variant="outlined"
                            color={isReset === false ? "error" : "secondary"}
                            onClick={handleResetState}
                            loading={isResetLoading}
                        >
                            {isReset === null ? "Reset" : isReset ? "Force Reset" : "Error"}
                        </LoadingButton>
                    </Tooltip>
                    <Tooltip title="Refresh Server Info">
                        <IconButton color="secondary" onClick={() => refetch().then()} disabled={isLoading}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                </>
            }
        >
            <Grid container spacing={2} p={2}>
                <Grid item xs={12} md={6}>
                    <DetailItem label="Name" value={data?.server_name || "???"} />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem
                        label="Version"
                        value={
                            <Box display="flex" alignItems="center">
                                {data?.server_version || "???"}
                                <VersionCheckIcon
                                    currentVersion={data?.server_version}
                                    progressProps={{
                                        size: "1rem",
                                        sx: { mx: 1 },
                                    }}
                                    fontSize="small"
                                    sx={{ mx: 1 }}
                                />
                            </Box>
                        }
                    />
                </Grid>
                <Grid item xs={12}>
                    <DetailItem
                        label="CPU Usage"
                        description="CPU usage by the server process"
                        value={
                            <LinearProgressWithLabel
                                value={data?.cpu_usage[2] || 0}
                                buffer={data?.cpu_usage[0] || 0}
                                percentageLabel
                            />
                        }
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem
                        label="Memory"
                        description="Total memory usage by the server process"
                        value={formatBytes(data?.memory_usage || 0)}
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem
                        label="Uptime"
                        description="Amount of time the server process has been running"
                        value={formatSecondsDurationLong(data?.uptime || 0)}
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem label="Hostname" value={data?.server_hostname || "???"} />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem label="Port" value={data?.server_port || "???"} />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem label="Server OS" value={data?.server_os || "???"} />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem label="Python Version" value={data?.python_version || "???"} />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem
                        label="Tasks"
                        description="Number of tasks stored in state / limit"
                        value={`${data?.task_count || 0} / ${data?.tasks_max_count || "Unknown"}`}
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem
                        label="Workers"
                        description="Number of workers stored in state / limit"
                        value={`${data?.worker_count || 0} / ${data?.worker_max_count || "Unknown"}`}
                    />
                </Grid>
                <Grid item xs={12}>
                    <Stack direction="row" justifyContent="space-around">
                        <LinkButton href="/docs">API Explorer</LinkButton>
                        <LinkButton href="/redoc">API Docs</LinkButton>
                    </Stack>
                </Grid>
            </Grid>
        </Panel>
    )
}
