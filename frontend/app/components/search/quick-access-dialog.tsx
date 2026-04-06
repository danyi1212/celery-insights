import ErrorAlert from "@components/errors/error-alert"
import { matchHelpNavigation } from "@components/documentation/help-navigation"
import TaskAvatar from "@components/task/task-avatar"
import { Avatar, AvatarFallback } from "@components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@components/ui/dialog"
import { Kbd } from "@components/ui/kbd"
import { ScrollArea } from "@components/ui/scroll-area"
import { useSearch } from "@hooks/use-search"
import { appLocations } from "@layout/navigation-links"
import { cn } from "@lib/utils"
import useSettingsStore from "@stores/use-settings-store"
import { TaskState, extractId } from "@/types/surreal-records"
import { useNavigate } from "@tanstack/react-router"
import { format } from "date-fns"
import { BookOpen, CornerDownLeft, Search, Server } from "lucide-react"
import React, { useEffect, useMemo, useRef, useState } from "react"

interface QuickAccessDialogProps {
    focusNonce?: number
    open: boolean
    onOpenChange: (open: boolean) => void
}

interface LocationItem {
    id: string
    kind: "location"
    icon: React.ReactNode
    subtitle: string
    title: string
    to: string
}

interface DocumentationItem {
    id: string
    kind: "documentation"
    icon: React.ReactNode
    subtitle: string
    title: string
    to: string
}

interface WorkerItem {
    id: string
    kind: "worker"
    title: string
    subtitle: string
    workerId: string
    icon: React.ReactNode
}

interface TaskItem {
    id: string
    kind: "task"
    title: string
    subtitle: string
    taskId: string
    icon: React.ReactNode
}

type QuickAccessItem = DocumentationItem | LocationItem | WorkerItem | TaskItem

interface QuickAccessSection {
    items: QuickAccessItem[]
    title: string
}

const formatTaskTime = (sentAt: string | null | undefined, lastUpdated: string) => {
    const sentAtDate = sentAt ? new Date(sentAt) : null
    if (sentAtDate && !Number.isNaN(sentAtDate.getTime())) {
        return format(sentAtDate, "HH:mm:ss")
    }

    const lastUpdatedDate = new Date(lastUpdated)
    return Number.isNaN(lastUpdatedDate.getTime()) ? "Unknown" : format(lastUpdatedDate, "HH:mm:ss")
}

const matchesLocation = (query: string, title: string, subtitle: string, keywords: string[]) => {
    if (!query) return true

    const haystack = [title, subtitle, ...keywords].join(" ").toLowerCase()
    return haystack.includes(query)
}

const QuickAccessDialog: React.FC<QuickAccessDialogProps> = ({ focusNonce = 0, open, onOpenChange }) => {
    const navigate = useNavigate()
    const isDemo = useSettingsStore((state) => state.demo)
    const inputRef = useRef<HTMLInputElement>(null)
    const wasOpenRef = useRef(false)
    const [query, setQuery] = useState("")
    const normalizedQuery = query.trim().toLowerCase()
    const { tasks, workers, isLoading, error } = useSearch(query, 6)
    const [highlightedIndex, setHighlightedIndex] = useState(0)

    useEffect(() => {
        if (open && !wasOpenRef.current) {
            setQuery("")
            setHighlightedIndex(0)
        }

        wasOpenRef.current = open
    }, [open])

    useEffect(() => {
        if (!open) return

        const frame = window.requestAnimationFrame(() => {
            inputRef.current?.focus()
            inputRef.current?.select()
        })

        return () => window.cancelAnimationFrame(frame)
    }, [focusNonce, open])

    const locationItems = useMemo<LocationItem[]>(
        () =>
            appLocations
                .filter((location) =>
                    matchesLocation(normalizedQuery, location.label, location.description, location.keywords),
                )
                .map(({ description, icon: Icon, label, to }) => ({
                    id: `location:${to}`,
                    kind: "location" as const,
                    title: label,
                    subtitle: description,
                    to,
                    icon: <Icon className="size-4" />,
                })),
        [normalizedQuery],
    )

    const documentationItems = useMemo<DocumentationItem[]>(
        () =>
            matchHelpNavigation(normalizedQuery).map((page) => ({
                id: `documentation:${page.href}`,
                kind: "documentation" as const,
                title: page.title,
                subtitle: `${page.group} • ${page.description}`,
                to: page.href,
                icon: <BookOpen className="size-4" />,
            })),
        [normalizedQuery],
    )

    const workerItems = useMemo<WorkerItem[]>(
        () =>
            workers.map((worker) => {
                const workerId = extractId(worker.id)
                return {
                    id: `worker:${workerId}`,
                    kind: "worker" as const,
                    title: worker.hostname || workerId,
                    subtitle: `Worker${worker.pid ? ` • PID ${worker.pid}` : ""}`,
                    workerId,
                    icon: (
                        <Avatar className="size-8">
                            <AvatarFallback>
                                <Server className="size-4" />
                            </AvatarFallback>
                        </Avatar>
                    ),
                }
            }),
        [workers],
    )

    const taskItems = useMemo<TaskItem[]>(
        () =>
            tasks.map((task) => {
                const taskId = extractId(task.id)
                return {
                    id: `task:${taskId}`,
                    kind: "task" as const,
                    title: task.type || "Unknown task",
                    subtitle: [
                        `Task • Sent at ${formatTaskTime(task.sent_at, task.last_updated)}`,
                        task.workflow?.root_task_type ? `Root ${task.workflow.root_task_type}` : null,
                        task.workflow?.aggregate_state ? `Workflow ${task.workflow.aggregate_state}` : null,
                        task.workflow?.task_count ? `${task.workflow.task_count} tasks` : null,
                    ]
                        .filter(Boolean)
                        .join(" • "),
                    taskId,
                    icon: <TaskAvatar taskId={taskId} type={task.type} status={task.state as TaskState} disableLink />,
                }
            }),
        [tasks],
    )

    const sections = useMemo<QuickAccessSection[]>(
        () => [
            { title: "Pages", items: locationItems },
            { title: "Documentation", items: documentationItems },
            { title: "Workers", items: normalizedQuery ? workerItems : [] },
            { title: "Tasks", items: normalizedQuery ? taskItems : [] },
        ],
        [documentationItems, locationItems, normalizedQuery, taskItems, workerItems],
    )

    const items = useMemo<QuickAccessItem[]>(() => sections.flatMap((section) => section.items), [sections])

    useEffect(() => {
        if (items.length === 0) {
            setHighlightedIndex(0)
            return
        }

        setHighlightedIndex((current) => Math.min(current, items.length - 1))
    }, [items])

    const selectItem = (item: QuickAccessItem) => {
        onOpenChange(false)

        if (item.kind === "location" || item.kind === "documentation") {
            navigate({ to: item.to })
            return
        }

        if (item.kind === "worker") {
            navigate({ to: "/workers/$workerId", params: { workerId: item.workerId } })
            return
        }

        navigate({ to: "/tasks/$taskId", params: { taskId: item.taskId } })
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "ArrowDown") {
            event.preventDefault()
            setHighlightedIndex((current) => (items.length === 0 ? 0 : (current + 1) % items.length))
            return
        }

        if (event.key === "ArrowUp") {
            event.preventDefault()
            setHighlightedIndex((current) => (items.length === 0 ? 0 : (current - 1 + items.length) % items.length))
            return
        }

        if (event.key === "Enter") {
            const item = items[highlightedIndex]
            if (!item) return

            event.preventDefault()
            selectItem(item)
        }
    }

    const showEmptyState = !isLoading && !error && items.length === 0

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl" showCloseButton={false}>
                <div className="sr-only">
                    <DialogTitle>Quick access</DialogTitle>
                    <DialogDescription>Search tasks, workers, pages, and app features.</DialogDescription>
                </div>

                <div className="border-b px-4 py-3">
                    <label className="flex items-center gap-3" htmlFor="quick-access-input">
                        <Search className="size-4 text-muted-foreground" />
                        <input
                            ref={inputRef}
                            id="quick-access-input"
                            type="text"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Search tasks, workers, pages, and features..."
                            className="w-full border-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                    </label>
                </div>

                <ScrollArea className="max-h-[26rem]">
                    <div className="p-2">
                        {error ? (
                            <ErrorAlert error={error} />
                        ) : isLoading ? (
                            <p className="px-3 py-8 text-sm text-muted-foreground">Searching...</p>
                        ) : showEmptyState ? (
                            <div className="px-3 py-8 text-sm text-muted-foreground">
                                <p>No matching pages, documentation, tasks, or workers.</p>
                            </div>
                        ) : (
                            <div aria-label="Quick access results" role="listbox">
                                {sections.map((section) => {
                                    if (section.items.length === 0) return null

                                    return (
                                        <div key={section.title} className="py-1">
                                            <div className="px-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                                {section.title}
                                            </div>
                                            <ul>
                                                {section.items.map((item) => {
                                                    const itemIndex = items.findIndex(
                                                        (candidate) => candidate.id === item.id,
                                                    )
                                                    const isActive = itemIndex === highlightedIndex

                                                    return (
                                                        <li key={item.id}>
                                                            <button
                                                                type="button"
                                                                role="option"
                                                                aria-selected={isActive}
                                                                onMouseMove={() => setHighlightedIndex(itemIndex)}
                                                                onClick={() => selectItem(item)}
                                                                className={cn(
                                                                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
                                                                    isActive
                                                                        ? "bg-accent text-accent-foreground"
                                                                        : "hover:bg-accent/60",
                                                                )}
                                                            >
                                                                <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                                                                    {item.icon}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="truncate text-sm font-medium">
                                                                        {item.title}
                                                                    </div>
                                                                    <div className="truncate text-xs text-muted-foreground">
                                                                        {item.subtitle}
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        </li>
                                                    )
                                                })}
                                            </ul>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
                    <span>
                        {isDemo
                            ? "Search pages or open matching embedded sample records."
                            : "Jump to pages or open matching entities."}
                    </span>
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                            <Kbd>Up</Kbd>
                            <Kbd>Down</Kbd>
                        </span>
                        <span className="flex items-center gap-1">
                            <Kbd>
                                <CornerDownLeft className="size-3.5" />
                            </Kbd>
                            Open
                        </span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default QuickAccessDialog
