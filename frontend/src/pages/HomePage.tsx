import Panel from "@components/common/Panel"
import ExceptionAlert from "@components/task/alerts/ExceptionAlert"
import RecentTasksList from "@components/task/RecentTasksList"
import WorkersSummaryStack from "@components/worker/WorkersSummaryStack"
import Button from "@mui/material/Button"
import Grid from "@mui/material/Grid"
import Stack from "@mui/material/Stack"
import { useStateStore } from "@stores/useStateStore"
import React from "react"
import { Link as RouterLink } from "react-router-dom"

const HomePage: React.FC = () => {
    const errors: Map<string, string | undefined> = useStateStore((state) =>
        state.tasks
            .map((task) => task)
            .filter((task) => task.exception)
            .reduce((acc, { exception, traceback }) => acc.set(exception, traceback), new Map())
    )
    return (
        <>
            <Stack spacing={3} mx={3}>
                {Array.from(errors.entries()).map(([exception, traceback]) => (
                    <ExceptionAlert key={exception} exception={exception} traceback={traceback} />
                ))}
            </Stack>
            <Grid container spacing={3} px={3}>
                <Grid item lg={8} xs={12}>
                    <Panel
                        title="Recent Tasks"
                        actions={
                            <Button component={RouterLink} to="/explorer" variant="outlined" color="secondary">
                                View All
                            </Button>
                        }
                    >
                        <RecentTasksList count={100} />
                    </Panel>
                </Grid>
                <Grid item lg={4} xs={12}>
                    <WorkersSummaryStack />
                </Grid>
            </Grid>
        </>
    )
}

export default HomePage
