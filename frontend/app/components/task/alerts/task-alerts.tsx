import ExceptionAlert from "@components/task/alerts/exception-alert"
import RetryAlert from "@components/task/alerts/retry-alert"
import { Collapsible, CollapsibleContent } from "@components/ui/collapsible"
import { useTask } from "@hooks/use-live-tasks"
import { extractId } from "@utils/translate-server-models"
import React from "react"

interface TaskAlertsProps {
    taskId: string
}

const TaskAlerts: React.FC<TaskAlertsProps> = ({ taskId }) => {
    const { task } = useTask(taskId)
    return (
        <>
            <Collapsible open={Boolean(task?.retries)}>
                <CollapsibleContent>
                    <RetryAlert retries={task?.retries} className="m-3" />
                </CollapsibleContent>
            </Collapsible>
            <Collapsible open={Boolean(task?.exception)}>
                <CollapsibleContent>
                    <ExceptionAlert
                        exception={task?.exception || ""}
                        traceback={task?.traceback}
                        currentTaskId={task ? extractId(task.id) : undefined}
                        className="m-3"
                    />
                </CollapsibleContent>
            </Collapsible>
        </>
    )
}
export default TaskAlerts
