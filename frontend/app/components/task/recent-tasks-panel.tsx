import AnimatedList from "@components/common/animated-list"
import AnimatedListItem from "@components/common/animated-list-item"
import CodeBlock from "@components/common/code-block"
import Panel, { PanelProps } from "@components/common/panel"
import TaskAvatar from "@components/task/task-avatar"
import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useLiveTasks } from "@hooks/use-live-tasks"
import { TaskState, extractId } from "@/types/surreal-records"
import type { SurrealTask } from "@/types/surreal-records"
import { format } from "date-fns"
import { ChevronRight } from "lucide-react"
import React from "react"
import { Link as RouterLink } from "@tanstack/react-router"

const RecentTaskListItem: React.FC<{ task: SurrealTask }> = ({ task }) => {
    const taskId = extractId(task.id)
    return (
        <AnimatedListItem disablePadding>
            <RouterLink
                to={`/tasks/${taskId}` as string}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent"
            >
                <div className="shrink-0">
                    <TaskAvatar taskId={taskId} type={task.type} status={task.state as TaskState} disableLink />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{task.type || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">
                        {taskId.slice(0, 8)}
                        {task.sent_at ? ` • Sent at ${format(new Date(task.sent_at), "HH:mm:ss")}` : ""}
                    </p>
                </div>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span>
                            <ChevronRight className="size-5 text-muted-foreground" />
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>View task...</TooltipContent>
                </Tooltip>
            </RouterLink>
        </AnimatedListItem>
    )
}

const RecentTasksPanel: React.FC<Omit<PanelProps, "title">> = (props) => {
    const { data: tasks } = useLiveTasks(30)

    return (
        <Panel
            title="Recent Tasks"
            actions={
                <Button variant="outline" asChild>
                    <RouterLink to="/explorer">View All</RouterLink>
                </Button>
            }
            {...props}
        >
            {tasks.length ? (
                <AnimatedList>
                    {tasks.map((task) => (
                        <RecentTaskListItem key={extractId(task.id)} task={task} />
                    ))}
                </AnimatedList>
            ) : (
                <div className="my-10 text-center">
                    <h4 className="mb-4 text-2xl font-semibold">No recent tasks</h4>
                    <span>Make sure you have Celery Events enabled:</span>
                    <div className="mx-auto max-w-[30em]">
                        <CodeBlock language="python">
                            {[
                                'app = Celery("myapp")',
                                "app.conf.worker_send_task_events = True",
                                "app.conf.task_send_sent_event = True",
                                "app.conf.task_track_started = True",
                                "app.conf.result_extended = True",
                                "app.conf.enable_utc = True",
                            ].join("\n")}
                        </CodeBlock>
                    </div>
                    <span>
                        For more information, see the{" "}
                        <a
                            href="/documentation/celery-clusters#baseline-event-settings"
                            className="text-primary underline underline-offset-4 hover:text-primary/80"
                        >
                            in-app documentation
                        </a>
                        .
                    </span>
                </div>
            )}
        </Panel>
    )
}
export default RecentTasksPanel
