import AnimatedList from "@components/common/AnimatedList"
import Panel, { PanelProps } from "@components/common/Panel"
import ActiveTaskListItem from "@components/worker/panels/tasks/ActiveTaskListItem"
import useWorkerActiveTasks from "@hooks/worker/useWorkerActiveTasks"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import React from "react"

interface ActiveTasksPanelProps extends Omit<PanelProps, "title"> {
    hostname: string
}

const ActiveTasksPanel: React.FC<ActiveTasksPanelProps> = ({ hostname, ...props }) => {
    const { tasks, isLoading, error } = useWorkerActiveTasks(hostname)
    return (
        <Panel title="Active Task" loading={isLoading} error={error} {...props}>
            {tasks && tasks.length > 0 ? (
                <AnimatedList disablePadding>
                    {tasks.map((task) => (
                        <ActiveTaskListItem key={task.id} task={task} />
                    ))}
                </AnimatedList>
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
