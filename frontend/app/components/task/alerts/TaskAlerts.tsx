import ExceptionAlert from "@components/task/alerts/ExceptionAlert"
import RetryAlert from "@components/task/alerts/RetryAlert"
import useTaskResult from "@hooks/task/useTaskResult"
import useTaskState from "@hooks/task/useTaskState"
import Collapse from "@mui/material/Collapse"
import React from "react"

interface TaskAlertsProps {
    taskId: string
}

const TaskAlerts: React.FC<TaskAlertsProps> = ({ taskId }) => {
    const { task } = useTaskState(taskId)
    const { taskResult } = useTaskResult(taskId)
    return (
        <>
            <Collapse in={Boolean(task?.retries || taskResult?.retries)} unmountOnExit>
                <RetryAlert retries={task?.retries || taskResult?.retries} sx={{ m: 3 }} />
            </Collapse>
            <Collapse in={Boolean(task?.exception)} unmountOnExit>
                <ExceptionAlert
                    exception={task?.exception || ""}
                    traceback={task?.traceback || taskResult?.traceback}
                    currentTaskId={task?.id}
                    sx={{ m: 3 }}
                />
            </Collapse>
        </>
    )
}
export default TaskAlerts
