import Panel from "@components/common/panel"
import JsonViewThemed from "@components/common/json-view-themed"
import { useTask } from "@hooks/use-live-tasks"
import React from "react"

interface ArgumentPanelProps extends React.ComponentProps<"div"> {
    taskId: string
}

const ArgumentPanel: React.FC<ArgumentPanelProps> = ({ taskId, ...props }) => {
    const { task, isLoading, error } = useTask(taskId)
    return (
        <Panel title="Arguments" loading={isLoading} error={error} {...props}>
            <div className="h-full">
                <JsonViewThemed
                    value={{
                        args: task?.args || "Unknown",
                        kwargs: task?.kwargs || "Unknown",
                    }}
                />
            </div>
        </Panel>
    )
}

export default ArgumentPanel
