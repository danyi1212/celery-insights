import { useNow } from "@hooks/use-now"
import { cn } from "@lib/utils"
import type { Task } from "@/types/surreal-records"
import {
    computeTaskPhases,
    formatDuration,
    formatTime,
    getTaskEndTime,
    isTerminalState,
    PHASE_COLORS,
    type TaskPhase,
} from "@utils/task-phases"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

const REALTIME_INTERVAL = 100

interface TaskLifetimeChartProps {
    task: Task
    className?: string
    showTimeAxis?: boolean
    showLegend?: boolean
    showDurationLabels?: boolean
    minPhaseWidth?: number
}

const PHASE_LEGEND = [
    { label: "Waiting in Queue", color: PHASE_COLORS.queue },
    { label: "Waiting in Worker", color: PHASE_COLORS.worker },
    { label: "Running", color: PHASE_COLORS.running },
]

const PhaseTooltip: React.FC<{ phase: TaskPhase }> = ({ phase }) => (
    <div className="flex flex-col gap-1 py-0.5">
        <div className="flex items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: phase.color }} />
            <span className="text-xs font-medium">{phase.label}</span>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
            <span className="text-muted-foreground">Duration</span>
            <span className="font-mono font-medium tabular-nums">{formatDuration(phase.durationMs)}</span>
            <span className="text-muted-foreground">Start</span>
            <span className="font-mono tabular-nums">{formatTime(new Date(phase.startMs), true)}</span>
            <span className="text-muted-foreground">End</span>
            <span className="font-mono tabular-nums">{formatTime(new Date(phase.endMs), true)}</span>
        </div>
    </div>
)

const TaskLifetimeChart: React.FC<TaskLifetimeChartProps> = ({
    task,
    className,
    showTimeAxis = true,
    showLegend = true,
    showDurationLabels = true,
    minPhaseWidth = 2,
}) => {
    const isActive = !isTerminalState(task.state)
    const now = useNow(isActive ? REALTIME_INTERVAL : undefined)
    const containerRef = useRef<HTMLDivElement>(null)
    const [containerWidth, setContainerWidth] = useState(0)
    const [hoveredPhase, setHoveredPhase] = useState<number | null>(null)

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

    const phases = useMemo(() => computeTaskPhases(task, now), [task, now])

    const totalDurationMs = useMemo(() => {
        if (phases.length === 0) return 0
        const start = phases[0].startMs
        const end = phases[phases.length - 1].endMs
        return end - start
    }, [phases])

    const timelineStart = useMemo(
        () => (phases.length > 0 ? phases[0].startMs : task.sent_at.getTime()),
        [phases, task.sent_at],
    )

    const timelineEnd = useMemo(() => getTaskEndTime(task, now).getTime(), [task, now])

    const ticks = useMemo(() => {
        if (!showTimeAxis || containerWidth === 0) return []
        const range = timelineEnd - timelineStart
        if (range <= 0) return []

        const targetTickCount = Math.max(2, Math.floor(containerWidth / 100))
        const rawInterval = range / targetTickCount
        const niceIntervals = [100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000]
        const interval = niceIntervals.find((n) => n >= rawInterval) ?? Math.ceil(rawInterval / 60000) * 60000

        const result: { ms: number; label: string; pct: number }[] = []
        const firstTick = Math.ceil(timelineStart / interval) * interval

        for (let t = firstTick; t <= timelineEnd; t += interval) {
            const pct = ((t - timelineStart) / range) * 100
            if (pct >= 0 && pct <= 100) {
                result.push({ ms: t, label: formatTime(new Date(t)), pct })
            }
        }
        return result
    }, [showTimeAxis, containerWidth, timelineStart, timelineEnd])

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent, idx: number) => {
            if (e.key === "ArrowRight" && idx < phases.length - 1) {
                e.preventDefault()
                const next = containerRef.current?.querySelector(
                    `[data-phase-index="${idx + 1}"]`,
                ) as HTMLElement | null
                next?.focus()
            } else if (e.key === "ArrowLeft" && idx > 0) {
                e.preventDefault()
                const prev = containerRef.current?.querySelector(
                    `[data-phase-index="${idx - 1}"]`,
                ) as HTMLElement | null
                prev?.focus()
            }
        },
        [phases.length],
    )

    if (phases.length === 0) {
        return (
            <div className={cn("flex items-center justify-center p-8 text-sm text-muted-foreground", className)}>
                No lifecycle data available
            </div>
        )
    }

    return (
        <div className={cn("flex flex-col w-full gap-3", className)}>
            {/* Main bar area */}
            <div
                ref={containerRef}
                className="relative"
                role="img"
                aria-label={`Task lifecycle: ${phases.map((p) => `${p.label} ${formatDuration(p.durationMs)}`).join(", ")}. Total: ${formatDuration(totalDurationMs)}`}
            >
                {/* The stacked bar */}
                <div
                    className="flex h-10 w-full overflow-hidden rounded-md"
                    role="group"
                    aria-label="Task lifecycle phases"
                >
                    {phases.map((phase, idx) => {
                        const widthPct =
                            totalDurationMs > 0
                                ? Math.max(
                                      (minPhaseWidth / (containerWidth || 400)) * 100,
                                      (phase.durationMs / totalDurationMs) * 100,
                                  )
                                : 100 / phases.length
                        const isHovered = hoveredPhase === idx
                        const showLabel =
                            showDurationLabels && containerWidth > 0 && (widthPct / 100) * containerWidth > 48

                        return (
                            <Tooltip key={phase.label}>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        data-phase-index={idx}
                                        aria-label={`${phase.label}: ${formatDuration(phase.durationMs)}`}
                                        className={cn(
                                            "relative flex cursor-default items-center justify-center outline-none transition-opacity duration-150",
                                            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                                            hoveredPhase !== null && !isHovered && "opacity-60",
                                        )}
                                        style={{
                                            width: `${widthPct}%`,
                                            backgroundColor: phase.color,
                                            minWidth: `${minPhaseWidth}px`,
                                        }}
                                        onMouseEnter={() => setHoveredPhase(idx)}
                                        onMouseLeave={() => setHoveredPhase(null)}
                                        onFocus={() => setHoveredPhase(idx)}
                                        onBlur={() => setHoveredPhase(null)}
                                        onKeyDown={(e) => handleKeyDown(e, idx)}
                                    >
                                        {showLabel && (
                                            <span className="pointer-events-none select-none whitespace-nowrap px-1 text-xs font-semibold text-foreground drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                                                {formatDuration(phase.durationMs)}
                                            </span>
                                        )}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-64 bg-popover text-popover-foreground">
                                    <PhaseTooltip phase={phase} />
                                </TooltipContent>
                            </Tooltip>
                        )
                    })}

                    {/* Animated pulse at the trailing edge when active */}
                    {isActive && <div className="absolute right-0 top-0 h-full w-0.5 animate-pulse bg-foreground/80" />}
                </div>

                {/* Time axis */}
                {showTimeAxis && ticks.length > 0 && (
                    <div className="relative mt-1.5 h-5" aria-hidden="true">
                        {ticks.map((tick) => (
                            <span
                                key={tick.ms}
                                className="absolute -translate-x-1/2 font-mono text-xs leading-none tabular-nums text-muted-foreground"
                                style={{ left: `${tick.pct}%` }}
                            >
                                {tick.label}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer bar area */}
            <div className="flex items-center">
                {/* Legend */}
                {showLegend && (
                    <div className="flex items-center gap-x-3" role="list" aria-label="Chart legend">
                        {PHASE_LEGEND.map((item) => (
                            <div key={item.label} className="flex items-center gap-1" role="listitem">
                                <span
                                    className="size-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: item.color }}
                                    aria-hidden="true"
                                />
                                <span className="text-xs leading-none text-muted-foreground">{item.label}</span>
                            </div>
                        ))}
                    </div>
                )}
                <div className="grow" />
                <span className="flex items-center gap-2 font-mono text-xs tabular-nums text-muted-foreground">
                    Total: {formatDuration(totalDurationMs)}
                    {isActive && (
                        <span className="flex items-center gap-1.5" aria-label="Updating in real-time">
                            <span className="relative flex size-2">
                                <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-success opacity-75" />
                                <span className="relative inline-flex size-2 rounded-full bg-status-success" />
                            </span>
                            <span className="font-sans font-medium text-status-success">Live</span>
                        </span>
                    )}
                </span>
            </div>
        </div>
    )
}

export default TaskLifetimeChart
