import Panel from "@components/common/Panel"
import ErrorsList from "@components/task/ErrorsList"
import RecentTasksList from "@components/task/RecentTasksList"
import Grid from "@mui/material/Grid"
import React from "react"

function HomePage() {
    return (
        <Grid container spacing={3} px={3}>
            <Grid item xs={8}>
                <Panel title="Recent Tasks">
                    <RecentTasksList />
                </Panel>
            </Grid>
            <Grid item xs={4}>
                <Panel title="Error Log">
                    <ErrorsList />
                </Panel>
            </Grid>
        </Grid>
    )
}

export default HomePage
