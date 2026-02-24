import AnimatedList from "@components/common/AnimatedList"
import Panel, { PanelProps } from "@components/common/Panel"
import ScheduledTaskListItem from "@components/worker/panels/tasks/ScheduledTaskListItem"
import useWorkerScheduledTasks from "@hooks/worker/useWorkerScheduledTasks"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import React from "react"

interface ScheduledTasksPanelProps extends Omit<PanelProps, "title"> {
    hostname: string
}

const ScheduledTasksPanel: React.FC<ScheduledTasksPanelProps> = ({ hostname, ...props }) => {
    const { tasks, isLoading, error } = useWorkerScheduledTasks(hostname)
    return (
        <Panel title="Scheduled Task" loading={isLoading} error={error} {...props}>
            {tasks && tasks.length > 0 ? (
                <AnimatedList disablePadding>
                    {tasks.map((task, index) => (
                        <ScheduledTaskListItem key={index} task={task} />
                    ))}
                </AnimatedList>
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
