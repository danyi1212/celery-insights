import TaskListItem from "@components/worker/panels/tasks/TaskListItem"
import { TaskRequest } from "@services/server"
import React from "react"

interface ReservedTaskListItemProps {
    task: TaskRequest
}

const ReservedTaskListItem: React.FC<ReservedTaskListItemProps> = ({ task }) => {
    return <TaskListItem task={task} subtitle={"Routing key: " + task.delivery_info.routing_key} />
}
export default ReservedTaskListItem
