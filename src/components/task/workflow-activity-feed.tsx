import AnimatedList from "@components/common/animated-list"
import AnimatedListItem from "@components/common/animated-list-item"
import CodeBlock from "@components/common/code-block"
import Panel, { type PanelProps } from "@components/common/panel"
import TaskAvatar from "@components/task/task-avatar"
import TaskStateBadge from "@components/task/task-state-badge"
import { AvatarGroup, AvatarGroupCount } from "@components/ui/avatar"
import { Button } from "@components/ui/button"
import { useLiveWorkflowTasks, useLiveWorkflows } from "@hooks/use-live-workflows"
import { extractId, parseWorkflow, TaskState, type SurrealTask } from "@/types/surreal-records"
import { Link as RouterLink } from "@tanstack/react-router"
import { format } from "date-fns"
import { ChevronRight } from "lucide-react"
import { useMemo } from "react"

const sortNotableTasks = (left: SurrealTask, right: SurrealTask) => {
  const rank = (task: SurrealTask) => {
    if (task.state === "FAILURE") return 0
    if (task.state === "STARTED" || task.state === "RECEIVED" || task.state === "RETRY" || task.state === "PENDING") {
      return 1
    }
    return 2
  }

  const leftRank = rank(left)
  const rightRank = rank(right)
  if (leftRank !== rightRank) return leftRank - rightRank
  return new Date(right.last_updated).getTime() - new Date(left.last_updated).getTime()
}

const WorkflowActivityFeed = (props: Omit<PanelProps, "title">) => {
  const { data: workflows, isLoading, error } = useLiveWorkflows(30)
  const workflowIds = useMemo(() => workflows.map((workflow) => extractId(workflow.id)), [workflows])
  const { data: tasks } = useLiveWorkflowTasks(workflowIds)

  const tasksByWorkflow = useMemo(() => {
    const groups = new Map<string, SurrealTask[]>()
    for (const task of tasks) {
      const workflowId = task.workflow_id || task.root_id || extractId(task.id)
      const existing = groups.get(workflowId) ?? []
      existing.push(task)
      groups.set(workflowId, existing)
    }
    return groups
  }, [tasks])

  return (
    <Panel
      title="Recent Activity"
      titleClassName="text-lg"
      headerClassName="min-h-11 px-3"
      loading={isLoading}
      error={error}
      {...props}
    >
      {workflows.length ? (
        <div>
          <AnimatedList>
            {workflows.map((rawWorkflow) => {
              const workflow = parseWorkflow(rawWorkflow)
              const workflowTasks = (tasksByWorkflow.get(workflow.id) ?? []).sort(sortNotableTasks)
              const visibleTasks = workflowTasks.slice(0, 5)
              const remainingTaskCount = Math.max(workflowTasks.length - visibleTasks.length, 0)
              const supportingStats = [
                `${workflow.task_count} task${workflow.task_count === 1 ? "" : "s"}`,
                workflow.worker_count
                  ? `${workflow.worker_count} worker${workflow.worker_count === 1 ? "" : "s"}`
                  : null,
                workflow.last_updated ? `Updated ${format(workflow.last_updated, "HH:mm:ss")}` : null,
              ].filter(Boolean)

              const stateDetails = [
                workflow.failure_count > 0 ? `${workflow.failure_count} failed` : null,
                workflow.retry_count > 0 ? `${workflow.retry_count} retrying` : null,
                workflow.active_count > 0 ? `${workflow.active_count} active` : null,
                workflow.completed_count > 0 ? `${workflow.completed_count} done` : null,
              ].filter(Boolean)

              return (
                <AnimatedListItem key={workflow.id} disablePadding>
                  <div className="flex items-start justify-between gap-2 rounded-lg border px-2.5 py-1">
                    <RouterLink
                      to="/tasks/$taskId"
                      params={{ taskId: workflow.root_task_id }}
                      className="flex min-w-0 flex-1 items-start gap-2.5 rounded-md px-1 py-0.5 transition-colors hover:bg-accent"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="truncate text-sm font-semibold">
                            {workflow.root_task_type || "Workflow root"}
                          </h4>
                          <TaskStateBadge state={workflow.aggregate_state} />
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {supportingStats.join(" • ")}
                          {stateDetails.length ? ` • ${stateDetails.join(" • ")}` : ""}
                        </p>
                      </div>
                      <AvatarGroup className="mt-0.5 shrink-0 *:data-[slot=avatar]:size-7 *:data-[slot=avatar]:ring-1">
                        {visibleTasks.map((task, index) => {
                          const taskId = extractId(task.id)
                          return (
                            <TaskAvatar
                              key={taskId}
                              taskId={taskId}
                              type={task.type}
                              status={task.state as TaskState}
                              tooltipSide="top"
                              statusReveal={index < visibleTasks.length - 1 ? "hover" : "always"}
                              className="size-7"
                            />
                          )
                        })}
                        {remainingTaskCount > 0 ? <AvatarGroupCount>+{remainingTaskCount}</AvatarGroupCount> : null}
                      </AvatarGroup>
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    </RouterLink>
                  </div>
                </AnimatedListItem>
              )
            })}
          </AnimatedList>
          <div className="border-t border-border/70 px-2.5 py-2">
            <Button variant="ghost" className="h-8 w-full justify-between px-2 text-sm" asChild>
              <RouterLink to="/explorer">
                Explore all workflows
                <ChevronRight className="size-4" />
              </RouterLink>
            </Button>
          </div>
        </div>
      ) : (
        <div className="my-10 text-center">
          <h4 className="mb-4 text-2xl font-semibold">No recent task activity</h4>
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
        </div>
      )}
    </Panel>
  )
}

export default WorkflowActivityFeed
