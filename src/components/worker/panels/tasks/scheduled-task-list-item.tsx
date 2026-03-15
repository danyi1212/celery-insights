import TaskListItem from "@components/worker/panels/tasks/task-list-item"
import { useNow } from "@hooks/use-now"
import type { ScheduledTask } from "@/types/surreal-records"
import { formatDistanceStrict } from "date-fns"
import React, { useMemo } from "react"

interface ScheduledTaskListItemProps {
  task: ScheduledTask
}

const ScheduledTaskListItem: React.FC<ScheduledTaskListItemProps> = ({ task }) => {
  const now = useNow(1000)
  const etaTime = useMemo(() => new Date(task.eta), [task.eta])
  const subtitle = useMemo(() => formatDistanceStrict(etaTime, now), [etaTime, now])
  return <TaskListItem task={task.request} subtitle={"Starting in " + subtitle} />
}
export default ScheduledTaskListItem
