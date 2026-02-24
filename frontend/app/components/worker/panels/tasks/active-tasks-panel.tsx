import AnimatedList from "@components/common/animated-list"
import Panel, { PanelProps } from "@components/common/panel"
import ActiveTaskListItem from "@components/worker/panels/tasks/active-task-list-item"
import useWorkerActiveTasks from "@hooks/worker/use-worker-active-tasks"
import React from "react"

interface ActiveTasksPanelProps extends Omit<PanelProps, "title"> {
    hostname: string
}

const ActiveTasksPanel: React.FC<ActiveTasksPanelProps> = ({ hostname, ...props }) => {
    const { tasks, isLoading, error } = useWorkerActiveTasks(hostname)
    return (
        <Panel title="Active Task" loading={isLoading} error={error} {...props}>
            {tasks && tasks.length > 0 ? (
                <AnimatedList>
                    {tasks.map((task, index) => (
                        <ActiveTaskListItem key={index} task={task} />
                    ))}
                </AnimatedList>
            ) : (
                <div className="flex items-center justify-center p-3">
                    <h4 className="text-center text-2xl font-semibold">No active tasks</h4>
                </div>
            )}
        </Panel>
    )
}

export default ActiveTasksPanel
