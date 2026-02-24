import PanelPaper from "@components/common/PanelPaper"
import ErrorAlert from "@components/errors/ErrorAlert"
import { cn } from "@lib/utils"
import { Loader2 } from "lucide-react"
import React, { useMemo } from "react"

export interface PanelProps extends React.ComponentProps<"div"> {
    title: string
    titleClassName?: string
    actions?: React.ReactNode
    children?: React.ReactNode
    loading?: boolean
    error?: unknown
}

const Panel: React.FC<PanelProps> = ({
    title,
    children,
    actions,
    titleClassName,
    loading,
    error,
    className,
    ...props
}) => {
    const content = useMemo(() => {
        if (loading)
            return (
                <div className="flex h-full w-full items-center justify-center">
                    <Loader2 className="size-8 animate-spin text-primary" />
                </div>
            )
        else if (error)
            return (
                <div className="flex h-full w-full items-center justify-center">
                    <ErrorAlert error={error} />
                </div>
            )
        else return children
    }, [loading, error, children])
    return (
        <div className="flex h-full flex-col">
            <div className="flex min-h-16 items-center gap-2 px-4">
                <h4 className={cn("flex-grow truncate text-2xl font-semibold", titleClassName)}>{title}</h4>
                {actions}
            </div>
            <PanelPaper className={className} {...props}>
                {content}
            </PanelPaper>
        </div>
    )
}
export default Panel
