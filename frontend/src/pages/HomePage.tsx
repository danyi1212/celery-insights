import ExceptionsSummary from "@components/task/alerts/ExceptionsSummary"
import RecentTasksPanel from "@components/task/RecentTasksPanel"
import WelcomeBanner from "@components/WelcomeBanner"
import WorkersSummaryStack from "@components/worker/WorkersSummaryStack"
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline"
import Box from "@mui/material/Box"
import CircularProgress from "@mui/material/CircularProgress"
import Collapse from "@mui/material/Collapse"
import Grid from "@mui/material/Grid"
import Typography from "@mui/material/Typography"
import useSettingsStore from "@stores/useSettingsStore"
import { useStateStore } from "@stores/useStateStore"
import React from "react"

import { ReadyState } from "react-use-websocket"

const HomePage: React.FC = () => {
    const hideWelcomeBanner = useSettingsStore((state) => state.hideWelcomeBanner)
    const isDemo = useSettingsStore((state) => state.demo)
    const wsStatus = useStateStore((state) => state.status)
    if (!isDemo && wsStatus !== ReadyState.OPEN) {
        return (
            <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" height="100%">
                {wsStatus === ReadyState.CONNECTING || wsStatus === ReadyState.UNINSTANTIATED ? (
                    <CircularProgress />
                ) : (
                    <>
                        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                            <ErrorOutlineIcon
                                sx={{ fontSize: (theme) => theme.typography.h3.fontSize, mr: 2 }}
                                color="error"
                            />
                            <Typography variant="h3" color="textPrimary">
                                Unable to connect to the server
                            </Typography>
                        </Box>
                        <Typography variant="h5">
                            <ul>
                                <li>Make sure you are connected to the network</li>
                                <li>Check the server logs for any error messages or issues</li>
                                <li>Try restarting the server</li>
                            </ul>
                        </Typography>
                    </>
                )}
            </Box>
        )
    }
    return (
        <>
            <Collapse in={!hideWelcomeBanner} unmountOnExit>
                <WelcomeBanner />
            </Collapse>
            <ExceptionsSummary />
            <Grid container spacing={3} px={3}>
                <Grid item lg={8} xs={12}>
                    <RecentTasksPanel id="recent-tasks" />
                </Grid>
                <Grid item lg={4} xs={12}>
                    <WorkersSummaryStack />
                </Grid>
            </Grid>
        </>
    )
}

export default HomePage
