import ExceptionAlert from "@components/task/alerts/exception-alert"
import { Badge } from "@components/ui/badge"
import { Collapsible, CollapsibleContent } from "@components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { cn } from "@lib/utils"
import { useExceptionsSummary } from "@hooks/use-exceptions-summary"
import React, { useState } from "react"

const ExceptionsSummary: React.FC = () => {
    const { data: exceptions } = useExceptionsSummary()
    const [selectedError, setSelectedError] = useState<string | null>(null)

    return (
        <div className="mx-2">
            <div className="mt-3 flex flex-wrap">
                {exceptions.map((entry) => (
                    <Tooltip key={entry.exception}>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() =>
                                    setSelectedError(selectedError === entry.exception ? null : entry.exception)
                                }
                                className={cn(
                                    "mx-1 inline-flex max-w-[300px] cursor-pointer items-center gap-1.5 truncate rounded-full border px-3 py-1 text-sm transition-colors",
                                    selectedError === entry.exception
                                        ? "border-destructive bg-destructive text-white"
                                        : "border-destructive text-destructive hover:bg-destructive/10",
                                )}
                            >
                                <Badge variant="destructive" className="size-5 justify-center rounded-full p-0 text-xs">
                                    {entry.count}
                                </Badge>
                                <span className="truncate">{entry.exception}</span>
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>Click to show error</TooltipContent>
                    </Tooltip>
                ))}
            </div>
            <Collapsible open={Boolean(selectedError)}>
                <CollapsibleContent>
                    <ExceptionAlert exception={selectedError || ""} traceback={undefined} className="my-2" />
                </CollapsibleContent>
            </Collapsible>
        </div>
    )
}

export default ExceptionsSummary
