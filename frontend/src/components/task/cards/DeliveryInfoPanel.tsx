import DetailItem from "@components/common/DetailItem"
import Panel from "@components/common/Panel"
import useTaskState from "@hooks/task/useTaskState"
import Grid from "@mui/material/Grid"
import Link from "@mui/material/Link"
import React from "react"
import { Link as RouterLink } from "react-router-dom"

interface DeliveryInfoPanelProps {
    taskId: string
}

const DeliveryInfoPanel: React.FC<DeliveryInfoPanelProps> = ({ taskId }) => {
    const { task, loading, error } = useTaskState(taskId)
    return (
        <Panel title="Delivery Info" loading={loading} error={error}>
            <Grid container spacing={2} p={2}>
                <Grid item xs={12}>
                    <DetailItem
                        label="Worker"
                        description="Worker that consumed this task"
                        value={
                            <Link component={RouterLink} to={`/workers/${task?.worker}`}>
                                {task?.worker || "Unknown"}
                            </Link>
                        }
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem
                        label="Exchange"
                        value={task?.exchange || "---"}
                        description="Name of the exchange this task was sent to"
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem
                        label="Routing Key"
                        description="Routing key this task was sent with"
                        value={task?.routingKey || "---"}
                    />
                </Grid>
            </Grid>
        </Panel>
    )
}
export default DeliveryInfoPanel
