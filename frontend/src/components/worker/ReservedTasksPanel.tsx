import Panel from "@components/common/Panel"
import ReservedTaskListItem from "@components/worker/ReservedTaskListItem"
import useWorkerReservedTasks from "@hooks/useWorkerReservedTasks"
import Box from "@mui/material/Box"
import List from "@mui/material/List"
import Typography from "@mui/material/Typography"
import { StateWorker } from "@utils/translateServerModels"
import React from "react"

interface ReservedTasksPanelProps {
    worker: StateWorker
}

const ReservedTasksPanel: React.FC<ReservedTasksPanelProps> = ({ worker }) => {
    const { tasks, isLoading, error } = useWorkerReservedTasks(worker)
    return (
        <Panel title="Reserved Task" loading={isLoading} error={error}>
            {tasks && tasks.length > 0 ? (
                <List disablePadding>
                    {tasks.map((task) => (
                        <ReservedTaskListItem key={task.id} task={task} />
                    ))}
                </List>
            ) : (
                <Box display="flex" justifyContent="center" alignItems="center" p={3}>
                    <Typography variant="h4" align="center">
                        No reserved tasks
                    </Typography>
                </Box>
            )}
        </Panel>
    )
}

export default ReservedTasksPanel
