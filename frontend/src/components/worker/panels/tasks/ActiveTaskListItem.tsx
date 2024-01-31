import TaskListItem from "@components/worker/panels/tasks/TaskListItem"
import { useNow } from "@hooks/useNow"
import { TaskRequest } from "@services/server"
import { formatDurationExact } from "@utils/FormatDurationExact"
import React, { useMemo } from "react"

interface ActiveTaskListItemProps {
    task: TaskRequest
}

const timestampToDate = (timestamp: number) => new Date(Date.UTC(1970, 0, 1, 0, 0, 0, timestamp * 1000))

const SubtitleText: React.FC<{ startTime: Date }> = ({ startTime }) => {
    const now = useNow(300)
    const duration = useMemo(() => formatDurationExact(now.getTime() - startTime.getTime()), [now, startTime])
    return <span>Running for {duration}</span>
}

const ActiveTaskListItem: React.FC<ActiveTaskListItemProps> = ({ task }) => {
    const startTime = useMemo(
        () => (task.time_start ? timestampToDate(task.time_start) : new Date()),
        [task.time_start],
    )

    return <TaskListItem task={task} subtitle={<SubtitleText startTime={startTime} />} />
}
export default ActiveTaskListItem
