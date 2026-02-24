import AnimatedList from "@components/common/AnimatedList"
import Panel, { PanelProps } from "@components/common/Panel"
import ReservedTaskListItem from "@components/worker/panels/tasks/ReservedTaskListItem"
import useWorkerReservedTasks from "@hooks/worker/useWorkerReservedTasks"
import React from "react"

interface ReservedTasksPanelProps extends Omit<PanelProps, "title"> {
    hostname: string
}

const ReservedTasksPanel: React.FC<ReservedTasksPanelProps> = ({ hostname, ...props }) => {
    const { tasks, isLoading, error } = useWorkerReservedTasks(hostname)
    return (
        <Panel title="Reserved Task" loading={isLoading} error={error} {...props}>
            {tasks && tasks.length > 0 ? (
                <AnimatedList>
                    {tasks.map((task, index) => (
                        <ReservedTaskListItem key={index} task={task} />
                    ))}
                </AnimatedList>
            ) : (
                <div className="flex items-center justify-center p-3">
                    <h4 className="text-center text-2xl font-semibold">No reserved tasks</h4>
                </div>
            )}
        </Panel>
    )
}

export default ReservedTasksPanel
