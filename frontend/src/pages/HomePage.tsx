import Panel from "@components/common/Panel"
import ErrorsList from "@components/task/ErrorsList"
import RecentTasksList from "@components/task/RecentTasksList"
import Grid from "@mui/material/Grid"
import React from "react"

function HomePage() {
    return (
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
    )
}

export default HomePage
