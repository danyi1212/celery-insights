import ExceptionAlert from "@components/task/alerts/exception-alert"
import RetryAlert from "@components/task/alerts/retry-alert"
import { Collapsible, CollapsibleContent } from "@components/ui/collapsible"
import useTaskResult from "@hooks/task/use-task-result"
import useTaskState from "@hooks/task/use-task-state"
import React from "react"

interface TaskAlertsProps {
    taskId: string
}

const TaskAlerts: React.FC<TaskAlertsProps> = ({ taskId }) => {
    const { task } = useTaskState(taskId)
    const { taskResult } = useTaskResult(taskId)
    return (
        <>
            <Collapsible open={Boolean(task?.retries || taskResult?.retries)}>
                <CollapsibleContent>
                    <RetryAlert retries={task?.retries || taskResult?.retries} className="m-3" />
                </CollapsibleContent>
            </Collapsible>
            <Collapsible open={Boolean(task?.exception)}>
                <CollapsibleContent>
                    <ExceptionAlert
                        exception={task?.exception || ""}
                        traceback={task?.traceback || taskResult?.traceback}
                        currentTaskId={task?.id}
                        className="m-3"
                    />
                </CollapsibleContent>
            </Collapsible>
        </>
    )
}
export default TaskAlerts
