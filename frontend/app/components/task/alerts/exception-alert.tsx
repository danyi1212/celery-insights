import CodeBlock from "@components/common/code-block"
import TaskAvatar from "@components/task/task-avatar"
import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"
import { AvatarGroup } from "@components/ui/avatar"
import { Button } from "@components/ui/button"
import { Collapsible, CollapsibleContent } from "@components/ui/collapsible"
import { cn } from "@lib/utils"
import { useMediaQuery } from "@hooks/use-media-query"
import { useStateStore } from "@stores/use-state-store"
import { StateTask } from "@utils/translate-server-models"
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react"
import React, { useCallback, useState } from "react"

interface ExceptionTracebackProps extends React.ComponentProps<"div"> {
    exception: string
    traceback?: string | null
    currentTaskId?: string
}

const ExceptionTraceback: React.FC<ExceptionTracebackProps> = ({
    exception,
    traceback,
    currentTaskId,
    className,
    ...props
}) => {
    const [expanded, setExpanded] = useState(false)
    const largeScreen = useMediaQuery("(min-width: 640px)")
    const similarTasks = useStateStore(
        useCallback(
            (state) => {
                const similar: StateTask[] = []
                if (largeScreen)
                    state.tasks.forEach((task) => {
                        if (task.id !== currentTaskId && task.exception === exception) similar.push(task)
                    })
                return similar
            },
            [largeScreen, currentTaskId, exception],
        ),
    )
    const showSimilar = similarTasks.length > 0 && largeScreen

    return (
        <Alert variant="destructive" className={cn("[&>svg+div]:flex-grow", className)} {...props}>
            <AlertCircle className="size-4" />
            <AlertTitle className="flex items-center">
                <span className="flex-grow">Failed Task</span>
                {showSimilar && (
                    <div className="flex items-center gap-2">
                        <span>Similar:</span>
                        <AvatarGroup>
                            {similarTasks.map((task) => (
                                <TaskAvatar key={task.id} taskId={task.id} type={task.type} className="size-6" />
                            ))}
                        </AvatarGroup>
                    </div>
                )}
            </AlertTitle>
            <AlertDescription>
                <p className="py-1">{exception}</p>
                {traceback && (
                    <>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpanded((prev) => !prev)}
                            className="gap-1 px-0"
                        >
                            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                            Traceback
                        </Button>
                        <Collapsible open={expanded}>
                            <CollapsibleContent>
                                <CodeBlock language="python">{traceback}</CodeBlock>
                            </CollapsibleContent>
                        </Collapsible>
                    </>
                )}
            </AlertDescription>
        </Alert>
    )
}

export default ExceptionTraceback
