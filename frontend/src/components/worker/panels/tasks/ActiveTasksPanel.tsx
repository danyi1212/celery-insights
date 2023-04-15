import Panel from "@components/common/Panel"
import ActiveTaskListItem from "@components/worker/panels/tasks/ActiveTaskListItem"
import useWorkerActiveTasks from "@hooks/worker/useWorkerActiveTasks"
import Box from "@mui/material/Box"
import List from "@mui/material/List"
import Typography from "@mui/material/Typography"
import { StateWorker } from "@utils/translateServerModels"
import React from "react"

interface ActiveTasksPanelProps {
    worker: StateWorker
}

const ActiveTasksPanel: React.FC<ActiveTasksPanelProps> = ({ worker }) => {
    const { tasks, isLoading, error } = useWorkerActiveTasks(worker)
    return (
        <Panel title="Active Task" loading={isLoading} error={error}>
            {tasks && tasks.length > 0 ? (
                <List disablePadding>
                    {tasks.map((task) => (
                        <ActiveTaskListItem key={task.id} task={task} />
                    ))}
                </List>
            ) : (
                <Box display="flex" justifyContent="center" alignItems="center" p={3}>
                    <Typography variant="h4" align="center">
                        No active tasks
                    </Typography>
                </Box>
            )}
        </Panel>
    )
}

export default ActiveTasksPanel
