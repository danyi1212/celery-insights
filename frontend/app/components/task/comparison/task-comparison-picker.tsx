import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card"
import { Input } from "@components/ui/input"
import { Skeleton } from "@components/ui/skeleton"
import TaskAvatar from "@components/task/task-avatar"
import TaskStatusIcon from "@components/task/task-status-icon"
import { useTaskCandidates } from "@hooks/use-task-candidates"
import { cn } from "@lib/utils"
import { ArrowLeftRight, Search } from "lucide-react"
import React, { useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"

interface TaskComparisonPickerProps {
    leftId?: string
    rightId?: string
    taskType?: string
    onSelectLeft: (id: string) => void
    onSelectRight: (id: string) => void
}

const TaskComparisonPicker: React.FC<TaskComparisonPickerProps> = ({
    leftId,
    rightId,
    taskType,
    onSelectLeft,
    onSelectRight,
}) => {
    const { candidates, isLoading } = useTaskCandidates(taskType)
    const [searchQuery, setSearchQuery] = useState("")

    const filteredCandidates = useMemo(() => {
        if (!searchQuery) return candidates
        const q = searchQuery.toLowerCase()
        return candidates.filter(
            (t) =>
                t.id.toLowerCase().includes(q) ||
                (t.type || "").toLowerCase().includes(q) ||
                t.state.toLowerCase().includes(q),
        )
    }, [candidates, searchQuery])

    const activeSlot = !leftId ? "left" : !rightId ? "right" : null
    const canCompare = !!leftId && !!rightId

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center gap-3">
                <ArrowLeftRight className="size-5 text-muted-foreground" />
                <h1 className="text-2xl font-semibold">Compare Tasks</h1>
                {taskType && (
                    <Badge variant="secondary" className="text-xs">
                        {taskType}
                    </Badge>
                )}
            </div>
            <p className="text-sm text-muted-foreground">
                Select two task executions to compare side by side.
                {taskType ? ` Showing recent tasks of type "${taskType}".` : " Showing recent tasks."}
            </p>

            <div className="grid grid-cols-2 gap-4">
                <SlotCard label="Left" taskId={leftId} slot="left" isActive={activeSlot === "left"} />
                <SlotCard label="Right" taskId={rightId} slot="right" isActive={activeSlot === "right"} />
            </div>

            {canCompare && (
                <div className="flex justify-center">
                    <Button asChild>
                        <Link to="/tasks/compare" search={{ left: leftId, right: rightId, type: taskType }}>
                            Compare
                        </Link>
                    </Button>
                </div>
            )}

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg">
                        {activeSlot ? `Select ${activeSlot} task` : "Select a task"}
                    </CardTitle>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                        <Input
                            placeholder="Filter by ID, type, or state..."
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex flex-col gap-2">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : filteredCandidates.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">No tasks found</p>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {filteredCandidates.map((task) => {
                                const isLeftSelected = leftId === task.id
                                const isRightSelected = rightId === task.id
                                const isSelected = isLeftSelected || isRightSelected

                                return (
                                    <button
                                        key={task.id}
                                        type="button"
                                        className={cn(
                                            "flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent",
                                            isSelected && "bg-accent/50",
                                        )}
                                        onClick={() => {
                                            if (isSelected) return
                                            if (!leftId) onSelectLeft(task.id)
                                            else if (!rightId) onSelectRight(task.id)
                                            else onSelectLeft(task.id)
                                        }}
                                    >
                                        <TaskAvatar
                                            taskId={task.id}
                                            type={task.type}
                                            status={task.state}
                                            disableLink
                                            className="size-8"
                                        />
                                        <div className="flex min-w-0 flex-col">
                                            <span className="truncate text-sm font-medium">{task.id}</span>
                                            <span className="truncate text-xs text-muted-foreground">
                                                {task.type || "Unknown"} - {task.last_updated.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="ml-auto flex items-center gap-2">
                                            <TaskStatusIcon status={task.state} />
                                            {isLeftSelected && (
                                                <Badge variant="outline" className="text-xs">
                                                    Left
                                                </Badge>
                                            )}
                                            {isRightSelected && (
                                                <Badge variant="outline" className="text-xs">
                                                    Right
                                                </Badge>
                                            )}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

const SlotCard: React.FC<{
    label: string
    taskId?: string
    slot: "left" | "right"
    isActive: boolean
}> = ({ label, taskId, isActive }) => (
    <Card className={cn("py-3 transition-colors", isActive && "ring-2 ring-primary", !taskId && "border-dashed")}>
        <CardContent className="flex items-center gap-3 px-4">
            {taskId ? (
                <>
                    <TaskAvatar taskId={taskId} type={undefined} disableLink className="size-8" />
                    <div className="flex min-w-0 flex-col">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className="truncate text-sm font-medium">{taskId}</span>
                    </div>
                </>
            ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex size-8 items-center justify-center rounded-full border-2 border-dashed text-xs">
                        {label[0]}
                    </span>
                    <span>Click a task below to select</span>
                </div>
            )}
        </CardContent>
    </Card>
)

export default TaskComparisonPicker
