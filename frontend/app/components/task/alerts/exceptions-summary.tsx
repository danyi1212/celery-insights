import ExceptionAlert from "@components/task/alerts/exception-alert"
import { Badge } from "@components/ui/badge"
import { Collapsible, CollapsibleContent } from "@components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { cn } from "@lib/utils"
import { useStateStore } from "@stores/use-state-store"
import React, { useMemo, useState } from "react"

const ExceptionsSummary: React.FC = () => {
    const errorsMap = useStateStore((state) => {
        const map = new Map<string, { count: number; traceback: string | undefined }>()
        state.tasks.forEach((task) => {
            if (task.exception) {
                const entry = map.get(task.exception)
                if (entry) {
                    map.set(task.exception, { count: entry.count + 1, traceback: task.traceback })
                } else {
                    map.set(task.exception, { count: 1, traceback: task.traceback })
                }
            }
        })
        return map
    })
    const [selectedError, setSelectedError] = useState<string | null>(null)
    const errorMessages = useMemo(() => Array.from(errorsMap.keys()), [errorsMap])

    return (
        <div className="mx-2">
            <div className="mt-3 flex flex-wrap">
                {errorMessages.map((error) => (
                    <Tooltip key={error}>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => setSelectedError(selectedError === error ? null : error)}
                                className={cn(
                                    "mx-1 inline-flex max-w-[300px] cursor-pointer items-center gap-1.5 truncate rounded-full border px-3 py-1 text-sm transition-colors",
                                    selectedError === error
                                        ? "border-destructive bg-destructive text-white"
                                        : "border-destructive text-destructive hover:bg-destructive/10",
                                )}
                            >
                                <Badge variant="destructive" className="size-5 justify-center rounded-full p-0 text-xs">
                                    {errorsMap.get(error)?.count || 0}
                                </Badge>
                                <span className="truncate">{error}</span>
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>Click to show error</TooltipContent>
                    </Tooltip>
                ))}
            </div>
            <Collapsible open={Boolean(selectedError)}>
                <CollapsibleContent>
                    <ExceptionAlert
                        exception={selectedError || ""}
                        traceback={errorsMap.get(selectedError || "")?.traceback}
                        className="my-2"
                    />
                </CollapsibleContent>
            </Collapsible>
        </div>
    )
}

export default ExceptionsSummary
