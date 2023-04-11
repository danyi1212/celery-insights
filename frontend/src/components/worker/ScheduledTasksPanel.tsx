import Panel from "@components/common/Panel"
import ScheduledTaskListItem from "@components/worker/ScheduledTaskListItem"
import useWorkerScheduledTasks from "@hooks/useWorkerScheduledTasks"
import Box from "@mui/material/Box"
import List from "@mui/material/List"
import Typography from "@mui/material/Typography"
import { StateWorker } from "@utils/translateServerModels"
import React from "react"

interface ScheduledTasksPanelProps {
    worker: StateWorker
}

const ScheduledTasksPanel: React.FC<ScheduledTasksPanelProps> = ({ worker }) => {
    const { tasks, isLoading, error } = useWorkerScheduledTasks(worker)
    return (
        <Panel title="Scheduled Task" loading={isLoading} error={error}>
            {tasks && tasks.length > 0 ? (
                <List disablePadding>
                    {tasks.map((task) => (
                        <ScheduledTaskListItem key={task.request.id} task={task} />
                    ))}
                </List>
            ) : (
                <Box display="flex" justifyContent="center" alignItems="center" p={3}>
                    <Typography variant="h4" align="center">
                        No scheduled tasks
                    </Typography>
                </Box>
            )}
        </Panel>
    )
}

export default ScheduledTasksPanel
