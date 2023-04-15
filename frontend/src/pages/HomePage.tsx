import Panel from "@components/common/Panel"
import ExceptionAlert from "@components/task/alerts/ExceptionAlert"
import ErrorsList from "@components/task/ErrorsList"
import RecentTasksList from "@components/task/RecentTasksList"
import WorkersSummary from "@components/worker/WorkersSummary"
import Grid from "@mui/material/Grid"
import Stack from "@mui/material/Stack"
import { useStateStore } from "@stores/useStateStore"
import React from "react"

const HomePage: React.FC = () => {
    const errors: Map<string, string | undefined> = useStateStore((state) =>
        state.tasks
            .map((task) => task)
            .filter((task) => task.exception)
            .reduce((acc, { exception, traceback }) => acc.set(exception, traceback), new Map())
    )
    return (
        <>
            <WorkersSummary />
            <Stack spacing={3} mx={3}>
                {Array.from(errors.entries()).map(([exception, traceback]) => (
                    <ExceptionAlert key={exception} exception={exception} traceback={traceback} />
                ))}
            </Stack>
            <Grid container spacing={3} px={3}>
                <Grid item lg={8} xs={12}>
                    <Panel title="Recent Tasks">
                        <RecentTasksList />
                    </Panel>
                </Grid>
                <Grid item lg={4} xs={12}>
                    <Panel title="Error Log">
                        <ErrorsList />
                    </Panel>
                </Grid>
            </Grid>
        </>
    )
}

export default HomePage
