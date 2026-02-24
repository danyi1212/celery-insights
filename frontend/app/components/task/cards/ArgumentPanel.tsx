import Panel from "@components/common/Panel"
import useTaskResult from "@hooks/task/useTaskResult"
import useTaskState from "@hooks/task/useTaskState"
import { useIsDark } from "@hooks/useIsDark"
import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import JsonView from "@uiw/react-json-view"
import { githubDarkTheme } from "@uiw/react-json-view/githubDark"
import { githubLightTheme } from "@uiw/react-json-view/githubLight"
import { HelpCircle } from "lucide-react"
import React from "react"

interface ArgumentPanelProps extends React.ComponentProps<"div"> {
    taskId: string
}

const HelpMessage: React.FC = () => (
    <span className="text-xs">
        Task arguments are shown as strings. <br />
        Enable{" "}
        <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://docs.celeryq.dev/en/stable/userguide/configuration.html#result-extended"
            className="underline"
        >
            result_extend
        </a>{" "}
        in Celery config to view the complete arguments as objects.
    </span>
)

const ArgumentPanel: React.FC<ArgumentPanelProps> = ({ taskId, ...props }) => {
    const isDark = useIsDark()
    const { task } = useTaskState(taskId)
    const { taskResult, isLoading, error } = useTaskResult(taskId)
    const showHelp = !isLoading && (!taskResult?.args || !taskResult?.kwargs)
    return (
        <Panel
            title="Arguments"
            actions={
                showHelp && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <HelpCircle className="size-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <HelpMessage />
                        </TooltipContent>
                    </Tooltip>
                )
            }
            loading={isLoading}
            error={error}
            {...props}
        >
            <div className="h-full">
                <JsonView
                    value={{
                        args: taskResult?.args || task?.args || "Unknown",
                        kwargs: taskResult?.kwargs || task?.kwargs || "Unknown",
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
