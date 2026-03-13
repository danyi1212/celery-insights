import { Badge } from "@components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card"
import { Separator } from "@components/ui/separator"
import TaskAvatar from "@components/task/task-avatar"
import TaskStatusIcon from "@components/task/task-status-icon"
import TaskLifetimeChart from "@components/task/task-lifetime-chart"
import { Skeleton } from "@components/ui/skeleton"
import { useTask } from "@hooks/use-live-tasks"
import { parseTask, TaskState, type Task } from "@/types/surreal-records"
import { formatDuration } from "@utils/task-phases"
import { cn } from "@lib/utils"
import { ArrowLeftRight, ArrowRight } from "lucide-react"
import React, { useMemo } from "react"
import { Link } from "@tanstack/react-router"

interface TaskComparisonViewProps {
    leftId: string
    rightId: string
    onChangeLeft: (id: string) => void
    onChangeRight: (id: string) => void
    taskType?: string
}

interface ComparisonRowProps {
    label: string
    left: React.ReactNode
    right: React.ReactNode
    highlight?: "different" | "same" | "none"
}

const ComparisonRow: React.FC<ComparisonRowProps> = ({ label, left, right, highlight = "none" }) => (
    <div
        className={cn(
            "grid grid-cols-[160px_1fr_1fr] items-start gap-3 rounded-md px-3 py-2",
            highlight === "different" && "bg-status-warning/10",
        )}
    >
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="min-w-0 break-words text-sm">{left}</span>
        <span className="min-w-0 break-words text-sm">{right}</span>
    </div>
)

const formatDate = (d?: Date) => (d ? d.toLocaleString() : "---")

const formatRuntimeMs = (runtime?: number) => {
    if (runtime == null) return "---"
    return formatDuration(runtime * 1000)
}

const runtimeDiff = (left?: number, right?: number): React.ReactNode => {
    if (left == null || right == null) return null
    const diffMs = (left - right) * 1000
    if (Math.abs(diffMs) < 1) return null
    const sign = diffMs > 0 ? "+" : ""
    const color = diffMs > 0 ? "text-status-danger" : "text-status-success"
    return (
        <span className={cn("text-xs", color)}>
            ({sign}
            {formatDuration(Math.abs(diffMs))})
        </span>
    )
}

const isDifferent = (a: unknown, b: unknown): boolean => {
    if (a === b) return false
    if (a == null && b == null) return false
    return String(a) !== String(b)
}

const TaskComparisonView: React.FC<TaskComparisonViewProps> = ({ leftId, rightId, taskType }) => {
    const { task: leftSurreal, isLoading: leftLoading } = useTask(leftId)
    const { task: rightSurreal, isLoading: rightLoading } = useTask(rightId)

    const left = useMemo(() => (leftSurreal ? parseTask(leftSurreal) : null), [leftSurreal])
    const right = useMemo(() => (rightSurreal ? parseTask(rightSurreal) : null), [rightSurreal])

    const isLoading = leftLoading || rightLoading

    if (isLoading) {
        return (
            <div className="flex flex-col gap-4 p-4">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-96 w-full" />
            </div>
        )
    }

    if (!left || !right) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8">
                <h2 className="text-xl font-semibold">Task not found</h2>
                <p className="text-muted-foreground">
                    {!left && `Could not find task ${leftId}`}
                    {!left && !right && " and "}
                    {!right && `Could not find task ${rightId}`}
                </p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center gap-3">
                <ArrowLeftRight className="size-5 text-muted-foreground" />
                <h1 className="text-2xl font-semibold">Task Comparison</h1>
                {taskType && (
                    <Badge variant="secondary" className="text-xs">
                        {taskType}
                    </Badge>
                )}
            </div>

            <TaskHeader left={left} right={right} />
            <LifetimeComparison left={left} right={right} />
            <MetadataComparison left={left} right={right} />
            <ArgumentComparison left={left} right={right} />
            <ResultComparison left={left} right={right} />
        </div>
    )
}

const TaskHeader: React.FC<{ left: Task; right: Task }> = ({ left, right }) => (
    <div className="grid grid-cols-2 gap-4">
        <TaskHeaderCard task={left} label="Left" />
        <TaskHeaderCard task={right} label="Right" />
    </div>
)

const TaskHeaderCard: React.FC<{ task: Task; label: string }> = ({ task, label }) => (
    <Card className="py-4">
        <CardContent className="flex items-center gap-3 px-4">
            <TaskAvatar taskId={task.id} type={task.type} status={task.state} disableLink />
            <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <TaskStatusIcon status={task.state} />
                </div>
                <Link
                    to="/tasks/$taskId"
                    params={{ taskId: task.id }}
                    className="truncate text-sm font-medium text-primary hover:underline"
                >
                    {task.id}
                </Link>
                <span className="truncate text-xs text-muted-foreground">{task.type || "Unknown type"}</span>
            </div>
        </CardContent>
    </Card>
)

const LifetimeComparison: React.FC<{ left: Task; right: Task }> = ({ left, right }) => (
    <Card>
        <CardHeader className="pb-2">
            <CardTitle className="text-lg">Lifetime</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <span className="mb-1 block text-xs text-muted-foreground">Left</span>
                    <TaskLifetimeChart task={left} showLegend={false} showTimeAxis={false} />
                </div>
                <div>
                    <span className="mb-1 block text-xs text-muted-foreground">Right</span>
                    <TaskLifetimeChart task={right} showLegend={false} showTimeAxis={false} />
                </div>
            </div>
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                <span>Left: {formatRuntimeMs(left.runtime)}</span>
                <ArrowRight className="size-4" />
                <span>Right: {formatRuntimeMs(right.runtime)}</span>
                {runtimeDiff(left.runtime, right.runtime)}
            </div>
        </CardContent>
    </Card>
)

const MetadataComparison: React.FC<{ left: Task; right: Task }> = ({ left, right }) => {
    const rows: {
        label: string
        format: (t: Task) => React.ReactNode
        key: keyof Task
    }[] = [
        { label: "State", format: (t) => <StateValue state={t.state} />, key: "state" },
        { label: "Worker", format: (t) => t.worker || "---", key: "worker" },
        { label: "Runtime", format: (t) => formatRuntimeMs(t.runtime), key: "runtime" },
        { label: "Retries", format: (t) => String(t.retries ?? 0), key: "retries" },
        { label: "Exchange", format: (t) => t.exchange || "---", key: "exchange" },
        { label: "Routing Key", format: (t) => t.routing_key || "---", key: "routing_key" },
        { label: "Sent At", format: (t) => formatDate(t.sent_at), key: "sent_at" },
        { label: "Started At", format: (t) => formatDate(t.started_at), key: "started_at" },
        { label: "ETA", format: (t) => t.eta || "---", key: "eta" },
        { label: "Expires", format: (t) => t.expires || "---", key: "expires" },
    ]

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg">Metadata</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-[160px_1fr_1fr] gap-3 px-3 pb-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Field</span>
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Left</span>
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Right</span>
                </div>
                <Separator />
                <div className="flex flex-col">
                    {rows.map((row) => (
                        <ComparisonRow
                            key={row.label}
                            label={row.label}
                            left={row.format(left)}
                            right={row.format(right)}
                            highlight={isDifferent(left[row.key], right[row.key]) ? "different" : "none"}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

const StateValue: React.FC<{ state: TaskState }> = ({ state }) => (
    <span className="inline-flex items-center gap-1.5">
        <TaskStatusIcon status={state} />
        <span>{state}</span>
    </span>
)

const ArgumentComparison: React.FC<{ left: Task; right: Task }> = ({ left, right }) => {
    const argsDiff = isDifferent(left.args, right.args)
    const kwargsDiff = isDifferent(left.kwargs, right.kwargs)

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                    Arguments
                    {(argsDiff || kwargsDiff) && (
                        <Badge variant="outline" className="text-xs text-status-warning">
                            Different
                        </Badge>
                    )}
                    {!argsDiff && !kwargsDiff && (
                        <Badge variant="outline" className="text-xs text-status-success">
                            Identical
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-[160px_1fr_1fr] gap-3 px-3 pb-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Field</span>
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Left</span>
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Right</span>
                </div>
                <Separator />
                <ComparisonRow
                    label="args"
                    left={<CodeBlock value={left.args} />}
                    right={<CodeBlock value={right.args} />}
                    highlight={argsDiff ? "different" : "none"}
                />
                <ComparisonRow
                    label="kwargs"
                    left={<CodeBlock value={left.kwargs} />}
                    right={<CodeBlock value={right.kwargs} />}
                    highlight={kwargsDiff ? "different" : "none"}
                />
            </CardContent>
        </Card>
    )
}

const ResultComparison: React.FC<{ left: Task; right: Task }> = ({ left, right }) => {
    const resultDiff = isDifferent(left.result, right.result)
    const hasException = left.exception || right.exception
    const exceptionDiff = isDifferent(left.exception, right.exception)

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                    Result
                    {resultDiff && (
                        <Badge variant="outline" className="text-xs text-status-warning">
                            Different
                        </Badge>
                    )}
                    {!resultDiff && (
                        <Badge variant="outline" className="text-xs text-status-success">
                            Identical
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-[160px_1fr_1fr] gap-3 px-3 pb-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Field</span>
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Left</span>
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Right</span>
                </div>
                <Separator />
                <ComparisonRow
                    label="Result"
                    left={<CodeBlock value={left.result} />}
                    right={<CodeBlock value={right.result} />}
                    highlight={resultDiff ? "different" : "none"}
                />
                {hasException && (
                    <>
                        <ComparisonRow
                            label="Exception"
                            left={<CodeBlock value={left.exception} className="text-status-danger" />}
                            right={<CodeBlock value={right.exception} className="text-status-danger" />}
                            highlight={exceptionDiff ? "different" : "none"}
                        />
                        <ComparisonRow
                            label="Traceback"
                            left={<CodeBlock value={left.traceback} className="max-h-48 overflow-auto" />}
                            right={<CodeBlock value={right.traceback} className="max-h-48 overflow-auto" />}
                            highlight={isDifferent(left.traceback, right.traceback) ? "different" : "none"}
                        />
                    </>
                )}
            </CardContent>
        </Card>
    )
}

const CodeBlock: React.FC<{ value?: string; className?: string }> = ({ value, className }) => {
    if (!value) return <span className="text-muted-foreground">---</span>
    return (
        <pre
            className={cn(
                "max-w-full overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-2 font-mono text-xs",
                className,
            )}
        >
            {value}
        </pre>
    )
}

export default TaskComparisonView
