import AnimatedList from "@components/common/AnimatedList"
import AnimatedListItem from "@components/common/AnimatedListItem"
import CodeBlock from "@components/common/CodeBlock"
import Panel, { PanelProps } from "@components/common/Panel"
import TaskAvatar from "@components/task/TaskAvatar"
import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useStateStore } from "@stores/useStateStore"
import { format } from "date-fns"
import { ChevronRight } from "lucide-react"
import React, { useCallback } from "react"
import { Link as RouterLink } from "@tanstack/react-router"

const RecentTaskListItem: React.FC<{ taskId: string }> = ({ taskId }) => {
    const task = useStateStore(useCallback((store) => store.tasks.get(taskId), [taskId]))
    return (
        <AnimatedListItem disablePadding>
            <RouterLink
                to={`/tasks/${taskId}`}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent"
            >
                <div className="shrink-0">
                    <TaskAvatar taskId={taskId} type={task?.type} status={task?.state} disableLink />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{task?.type || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">
                        {task?.sentAt && "Sent at " + format(task?.sentAt, "HH:mm:ss")}
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
    const recentTaskIds = useStateStore((state) => state.recentTaskIds)

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
            {recentTaskIds.length ? (
                <AnimatedList>
                    {recentTaskIds.map((taskId) => (
                        <RecentTaskListItem key={taskId} taskId={taskId} />
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
                            href="https://github.com/danyi1212/celery-insights?tab=readme-ov-file#enabling-celery-events"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline underline-offset-4 hover:text-primary/80"
                        >
                            Installation docs
                        </a>
                        .
                    </span>
                </div>
            )}
        </Panel>
    )
}
export default RecentTasksPanel
