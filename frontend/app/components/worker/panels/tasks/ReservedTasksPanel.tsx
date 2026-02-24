import AnimatedList from "@components/common/AnimatedList"
import Panel, { PanelProps } from "@components/common/Panel"
import ReservedTaskListItem from "@components/worker/panels/tasks/ReservedTaskListItem"
import useWorkerReservedTasks from "@hooks/worker/useWorkerReservedTasks"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import React from "react"

interface ReservedTasksPanelProps extends Omit<PanelProps, "title"> {
    hostname: string
}

const ReservedTasksPanel: React.FC<ReservedTasksPanelProps> = ({ hostname, ...props }) => {
    const { tasks, isLoading, error } = useWorkerReservedTasks(hostname)
    return (
        <Panel title="Reserved Task" loading={isLoading} error={error} {...props}>
            {tasks && tasks.length > 0 ? (
                <AnimatedList disablePadding>
                    {tasks.map((task, index) => (
                        <ReservedTaskListItem key={index} task={task} />
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
