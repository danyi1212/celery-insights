import DetailItem from "@components/common/DetailItem"
import Panel, { PanelProps } from "@components/common/Panel"
import useWorkerStats from "@hooks/worker/useWorkerStats"
import LockIcon from "@mui/icons-material/Lock"
import LockOpenIcon from "@mui/icons-material/LockOpen"
import Box from "@mui/material/Box"
import Grid from "@mui/material/Grid"
import Tooltip from "@mui/material/Tooltip"
import { formatSecondsDuration } from "@utils/formatSecondsDuration"
import React from "react"

interface BrokerDetailsCardProps extends Omit<PanelProps, "title"> {
    hostname: string
}

const BrokerDetailsCard: React.FC<BrokerDetailsCardProps> = ({ hostname, ...props }) => {
    const { stats, isLoading, error } = useWorkerStats(hostname)
    return (
        <Panel title="Broker" loading={isLoading} error={error} {...props}>
            <Grid container spacing={2} p={2}>
                <Grid item xs={12}>
                    <DetailItem
                        label="Hostname"
                        value={
                            <Box display="flex" alignItems="center">
                                {stats?.broker.hostname}
                                <Tooltip title={stats?.broker.ssl ? "SSL Enabled" : "SSL Disabled"} describeChild>
                                    {stats?.broker.ssl ? (
                                        <LockIcon fontSize="small" color="success" sx={{ mx: 1 }} />
                                    ) : (
                                        <LockOpenIcon fontSize="small" color="error" sx={{ mx: 1 }} />
                                    )}
                                </Tooltip>
                            </Box>
                        }
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem label="Port" value={stats?.broker.port} />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem label="Transport" value={stats?.broker.transport} />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem label="User ID" value={stats?.broker.userid} />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem label="Timeout" value={stats?.broker.connection_timeout ?? "Unlimited"} />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem
                        label="Heartbeat Interval"
                        value={formatSecondsDuration(stats?.broker.heartbeat || 0)}
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem label="Login Method" value={stats?.broker.login_method} />
                </Grid>
            </Grid>
        </Panel>
    )
}

export default BrokerDetailsCard
