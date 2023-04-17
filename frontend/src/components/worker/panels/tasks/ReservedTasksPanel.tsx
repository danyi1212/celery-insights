import AnimatedList from "@components/common/AnimatedList"
import Panel from "@components/common/Panel"
import ReservedTaskListItem from "@components/worker/panels/tasks/ReservedTaskListItem"
import useWorkerReservedTasks from "@hooks/worker/useWorkerReservedTasks"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import React from "react"

interface ReservedTasksPanelProps {
    hostname: string
}

const ReservedTasksPanel: React.FC<ReservedTasksPanelProps> = ({ hostname }) => {
    const { tasks, isLoading, error } = useWorkerReservedTasks(hostname)
    return (
        <Panel title="Reserved Task" loading={isLoading} error={error}>
            {tasks && tasks.length > 0 ? (
                <AnimatedList disablePadding>
                    {tasks.map((task) => (
                        <ReservedTaskListItem key={task.id} task={task} />
                    ))}
                </AnimatedList>
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
