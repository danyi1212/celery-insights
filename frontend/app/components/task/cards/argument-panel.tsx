import Panel from "@components/common/panel"
import { useTask } from "@hooks/use-live-tasks"
import { useIsDark } from "@hooks/use-is-dark"
import JsonView from "@uiw/react-json-view"
import { githubDarkTheme } from "@uiw/react-json-view/githubDark"
import { githubLightTheme } from "@uiw/react-json-view/githubLight"
import React from "react"

interface ArgumentPanelProps extends React.ComponentProps<"div"> {
    taskId: string
}

const ArgumentPanel: React.FC<ArgumentPanelProps> = ({ taskId, ...props }) => {
    const isDark = useIsDark()
    const { task, isLoading, error } = useTask(taskId)
    return (
        <Panel title="Arguments" loading={isLoading} error={error} {...props}>
            <div className="h-full">
                <JsonView
                    value={{
                        args: task?.args || "Unknown",
                        kwargs: task?.kwargs || "Unknown",
                    }}
                    style={isDark ? githubDarkTheme : githubLightTheme}
                    collapsed={2}
                    displayDataTypes={false}
                    enableClipboard={false}
                />
            </div>
        </Panel>
    )
}

export default ArgumentPanel
