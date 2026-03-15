import TaskListItem from "@components/worker/panels/tasks/task-list-item"
import type { TaskRequest } from "@/types/surreal-records"
import React from "react"

interface ReservedTaskListItemProps {
  task: TaskRequest
}

const ReservedTaskListItem: React.FC<ReservedTaskListItemProps> = ({ task }) => {
  return <TaskListItem task={task} subtitle={"Routing key: " + task.delivery_info?.routing_key} />
}
export default ReservedTaskListItem
