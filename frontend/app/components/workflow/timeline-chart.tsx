import TaskAvatar from "@components/task/task-avatar"
import { useNow } from "@hooks/use-now"
import { cn } from "@lib/utils"
import { TaskState } from "@/types/surreal-records"
import { StateTask } from "@/types/state-types"
import { formatDuration, formatTime, isTerminalState } from "@utils/task-phases"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useTourChangeStepOnLoad } from "@stores/use-tour-store"
import { useNavigate } from "@tanstack/react-router"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

const REALTIME_INTERVAL = 100

const STATE_BAR_COLORS: Record<TaskState, string> = {
    [TaskState.PENDING]: "#8b8b8b",
    [TaskState.RECEIVED]: "#60a5fa",
    [TaskState.STARTED]: "#3b82f6",
    [TaskState.SUCCESS]: "#4ade80",
    [TaskState.FAILURE]: "#f87171",
    [TaskState.REVOKED]: "#facc15",
    [TaskState.REJECTED]: "#f87171",
    [TaskState.RETRY]: "#facc15",
    [TaskState.IGNORED]: "#f87171",
}

const ROW_HEIGHT = 48
const LABEL_WIDTH = 56
const TIME_AXIS_HEIGHT = 24
const ROW_GAP = 4

interface TimelineChartProps {
    tasks: StateTask[]
    currentTaskId?: string
}

const getTaskEnd = (task: StateTask, now: Date): Date =>
    task.succeededAt || task.failedAt || task.retriedAt || task.rejectedAt || task.revokedAt || now

const TaskBarTooltip: React.FC<{ task: StateTask; durationMs: number }> = ({ task, durationMs }) => (
    <div className="flex flex-col gap-1.5 py-0.5">
        <div className="flex items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: STATE_BAR_COLORS[task.state] }} />
            <span className="text-xs font-medium">{task.type || task.id}</span>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[10px]">
            <span className="text-muted-foreground">State</span>
            <span className="font-medium">{task.state}</span>
            <span className="text-muted-foreground">Duration</span>
            <span className="font-mono font-medium tabular-nums">{formatDuration(durationMs)}</span>
            <span className="text-muted-foreground">Sent</span>
            <span className="font-mono tabular-nums">{formatTime(task.sentAt, true)}</span>
            {task.startedAt && (
                <>
                    <span className="text-muted-foreground">Started</span>
                    <span className="font-mono tabular-nums">{formatTime(task.startedAt, true)}</span>
                </>
            )}
            {task.worker && (
                <>
                    <span className="text-muted-foreground">Worker</span>
                    <span className="truncate font-mono">{task.worker}</span>
                </>
            )}
        </div>
        <span className="text-[10px] text-muted-foreground">Click to view details</span>
    </div>
)

const TimelineChart: React.FC<TimelineChartProps> = ({ tasks, currentTaskId }) => {
    useTourChangeStepOnLoad(5)
    const navigate = useNavigate()
    const containerRef = useRef<HTMLDivElement>(null)
    const [containerWidth, setContainerWidth] = useState(0)
    const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null)

    const sortedTasks = useMemo(() => [...tasks].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime()), [tasks])

    const isRealtime = useMemo(() => sortedTasks.some((task) => !isTerminalState(task.state)), [sortedTasks])
    const now = useNow(isRealtime ? REALTIME_INTERVAL : undefined)

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width)
            }
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    const barAreaWidth = Math.max(0, containerWidth - LABEL_WIDTH)

    const { timelineStart, timelineEnd, timeRange } = useMemo(() => {
        if (sortedTasks.length === 0) return { timelineStart: 0, timelineEnd: 0, timeRange: 0 }
        const start = sortedTasks[0].sentAt.getTime()
        const end = Math.max(...sortedTasks.map((t) => getTaskEnd(t, now).getTime()))
        // Add 2% padding on each side for visual breathing room
        const range = end - start
        const padding = range * 0.02
        return {
            timelineStart: start - padding,
            timelineEnd: end + padding,
            timeRange: range + padding * 2,
        }
    }, [sortedTasks, now])

    const ticks = useMemo(() => {
        if (barAreaWidth === 0 || timeRange <= 0) return []
        const targetTickCount = Math.max(2, Math.floor(barAreaWidth / 100))
        const rawInterval = timeRange / targetTickCount
        const niceIntervals = [100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000]
        const interval = niceIntervals.find((n) => n >= rawInterval) ?? Math.ceil(rawInterval / 60000) * 60000

        const result: { ms: number; label: string; pct: number }[] = []
        const firstTick = Math.ceil(timelineStart / interval) * interval

        for (let t = firstTick; t <= timelineEnd; t += interval) {
            const pct = ((t - timelineStart) / timeRange) * 100
            if (pct >= 0 && pct <= 100) {
                result.push({ ms: t, label: formatTime(new Date(t)), pct })
            }
        }
        return result
    }, [barAreaWidth, timelineStart, timelineEnd, timeRange])

    const handleTaskClick = useCallback(
        (taskId: string) => {
            navigate({ to: "/tasks/$taskId", params: { taskId } })
        },
        [navigate],
    )

    const isLarge = sortedTasks.length > 15
    const totalHeight = TIME_AXIS_HEIGHT + sortedTasks.length * (ROW_HEIGHT + ROW_GAP)

    if (sortedTasks.length === 0) {
        return (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No tasks in this workflow
            </div>
        )
    }

    return (
        <div className={cn("h-full w-full", isLarge ? "overflow-y-auto" : "overflow-y-clip")} ref={containerRef}>
            <div style={{ minHeight: totalHeight }}>
                {/* Time axis */}
                <div
                    className="sticky top-0 z-10 flex bg-background/90 backdrop-blur-sm"
                    style={{ height: TIME_AXIS_HEIGHT }}
                >
                    <div style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH }} className="shrink-0" />
                    <div className="relative flex-1">
                        {ticks.map((tick) => (
                            <React.Fragment key={tick.ms}>
                                <span
                                    className="absolute bottom-0 -translate-x-1/2 font-mono text-[10px] leading-none tabular-nums text-muted-foreground"
                                    style={{ left: `${tick.pct}%` }}
                                >
                                    {tick.label}
                                </span>
                                {/* Subtle vertical grid line */}
                                <span
                                    className="absolute top-full h-[calc(100vh)] w-px bg-border/30"
                                    style={{ left: `${tick.pct}%` }}
                                    aria-hidden="true"
                                />
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Task rows */}
                <div className="flex flex-col" style={{ gap: ROW_GAP }}>
                    {sortedTasks.map((task) => {
                        const startMs = task.sentAt.getTime()
                        const endMs = getTaskEnd(task, now).getTime()
                        const durationMs = endMs - startMs
                        const leftPct = timeRange > 0 ? ((startMs - timelineStart) / timeRange) * 100 : 0
                        const widthPct = timeRange > 0 ? ((endMs - startMs) / timeRange) * 100 : 100
                        const isHovered = hoveredTaskId === task.id
                        const isCurrent = task.id === currentTaskId
                        const isActiveTask = !isTerminalState(task.state)
                        const barColor = STATE_BAR_COLORS[task.state]
                        const showDurationLabel = barAreaWidth > 0 && (widthPct / 100) * barAreaWidth > 60

                        return (
                            <div
                                key={task.id}
                                className={cn(
                                    "group flex items-center transition-colors duration-100",
                                    hoveredTaskId !== null && !isHovered && "opacity-60",
                                    isCurrent && "bg-accent/30 rounded",
                                )}
                                style={{ height: ROW_HEIGHT }}
                                onMouseEnter={() => setHoveredTaskId(task.id)}
                                onMouseLeave={() => setHoveredTaskId(null)}
                            >
                                {/* Avatar */}
                                <div
                                    style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH }}
                                    className="flex shrink-0 items-center justify-center"
                                >
                                    <TaskAvatar
                                        taskId={task.id}
                                        type={task.type}
                                        status={task.state}
                                        disableLink
                                        className="size-9"
                                    />
                                </div>

                                {/* Bar area */}
                                <div className="relative flex-1" style={{ height: ROW_HEIGHT }}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                className={cn(
                                                    "absolute top-1 bottom-1 rounded-sm transition-all duration-100 cursor-pointer",
                                                    "hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background outline-none",
                                                    isCurrent && "ring-1 ring-foreground/30",
                                                )}
                                                style={{
                                                    left: `${leftPct}%`,
                                                    width: `${Math.max(widthPct, 0.3)}%`,
                                                    backgroundColor: barColor,
                                                }}
                                                onClick={() => handleTaskClick(task.id)}
                                                aria-label={`${task.type || task.id}: ${task.state}, ${formatDuration(durationMs)}`}
                                            >
                                                {showDurationLabel && (
                                                    <span className="pointer-events-none flex h-full items-center justify-center select-none whitespace-nowrap px-1.5 text-[11px] font-semibold text-foreground drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                                                        {formatDuration(durationMs)}
                                                    </span>
                                                )}

                                                {/* Active task pulse indicator */}
                                                {isActiveTask && (
                                                    <span className="absolute right-0 top-0 h-full w-0.5 animate-pulse bg-foreground/80 rounded-r-sm" />
                                                )}
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent
                                            side="top"
                                            className="max-w-72 bg-popover text-popover-foreground"
                                        >
                                            <TaskBarTooltip task={task} durationMs={durationMs} />
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default TimelineChart
