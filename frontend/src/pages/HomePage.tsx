import Panel from "@components/common/Panel"
import ExceptionsSummary from "@components/task/alerts/ExceptionsSummary"
import RecentTasksList from "@components/task/RecentTasksList"
import WorkersSummaryStack from "@components/worker/WorkersSummaryStack"
import Button from "@mui/material/Button"
import Grid from "@mui/material/Grid"
import React from "react"
import { Link as RouterLink } from "react-router-dom"

const HomePage: React.FC = () => {
    return (
        <Grid container spacing={3} px={3}>
            <Grid item xs={12}>
                <ExceptionsSummary />
            </Grid>
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
    )
}

export default HomePage
