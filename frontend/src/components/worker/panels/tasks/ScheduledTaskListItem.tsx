import TaskListItem from "@components/worker/panels/tasks/TaskListItem"
import { useNow } from "@hooks/useNow"
import { ScheduledTask } from "@services/server"
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
