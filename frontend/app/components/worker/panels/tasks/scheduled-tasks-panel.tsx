import AnimatedList from "@components/common/animated-list"
import Panel, { PanelProps } from "@components/common/panel"
import ScheduledTaskListItem from "@components/worker/panels/tasks/scheduled-task-list-item"
import useWorkerScheduledTasks from "@hooks/worker/use-worker-scheduled-tasks"
import React from "react"

interface ScheduledTasksPanelProps extends Omit<PanelProps, "title"> {
    hostname: string
}

const ScheduledTasksPanel: React.FC<ScheduledTasksPanelProps> = ({ hostname, ...props }) => {
    const { tasks, isLoading, error } = useWorkerScheduledTasks(hostname)
    return (
        <Panel title="Scheduled Task" loading={isLoading} error={error} {...props}>
            {tasks && tasks.length > 0 ? (
                <AnimatedList>
                    {tasks.map((task, index) => (
                        <ScheduledTaskListItem key={index} task={task} />
                    ))}
                </AnimatedList>
            ) : (
                <div className="flex items-center justify-center p-3">
                    <h4 className="text-center text-2xl font-semibold">No scheduled tasks</h4>
                </div>
            )}
        </Panel>
    )
}

export default ScheduledTasksPanel
