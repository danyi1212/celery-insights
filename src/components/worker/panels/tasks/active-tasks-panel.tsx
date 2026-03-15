import AnimatedList from "@components/common/animated-list"
import Panel, { PanelProps } from "@components/common/panel"
import ActiveTaskListItem from "@components/worker/panels/tasks/active-task-list-item"
import { useWorkerActiveTasks } from "@hooks/worker/use-worker-inspect"
import React from "react"

interface ActiveTasksPanelProps extends Omit<PanelProps, "title"> {
  workerId: string
}

const ActiveTasksPanel: React.FC<ActiveTasksPanelProps> = ({ workerId, ...props }) => {
  const { tasks, isLoading, error } = useWorkerActiveTasks(workerId)
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
