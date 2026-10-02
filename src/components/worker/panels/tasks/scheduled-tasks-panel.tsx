import AnimatedList from "@components/common/animated-list"
import Panel, { PanelProps } from "@components/common/panel"
import ScheduledTaskListItem from "@components/worker/panels/tasks/scheduled-task-list-item"
import { useWorkerScheduledTasks } from "@hooks/worker/use-worker-inspect"
import React from "react"

interface ScheduledTasksPanelProps extends Omit<PanelProps, "title"> {
  workerId: string
}

const ScheduledTasksPanel: React.FC<ScheduledTasksPanelProps> = ({ workerId, ...props }) => {
  const { tasks, isLoading, error } = useWorkerScheduledTasks(workerId)
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
