import TaskListItem from "@components/worker/panels/tasks/TaskListItem"
import { useNow } from "@hooks/useNow"
import { TaskRequest } from "@services/server"
import { formatDurationExact } from "@utils/FormatDurationExact"
import React, { useMemo } from "react"

interface ActiveTaskListItemProps {
    task: TaskRequest
}

const timestampToDate = (timestamp: number) => new Date(Date.UTC(1970, 0, 1, 0, 0, 0, timestamp * 1000))
const ActiveTaskListItem: React.FC<ActiveTaskListItemProps> = ({ task }) => {
    const now = useNow(300)
    const startTime = useMemo(
        () => (task.time_start ? timestampToDate(task.time_start) : new Date()),
        [task.time_start]
    )
    const subtitle = useMemo(() => formatDurationExact(now.getTime() - startTime.getTime()), [now, startTime])
    return <TaskListItem task={task} subtitle={"Running for " + subtitle} />
}
export default ActiveTaskListItem
