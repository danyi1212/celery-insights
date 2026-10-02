import { createFileRoute, Link } from "@tanstack/react-router"
import DetailItem from "@components/common/detail-item"
import JsonViewThemed from "@components/common/json-view-themed"
import Panel from "@components/common/panel"
import TaskAlerts from "@components/task/alerts/task-alerts"
import TaskAvatar from "@components/task/task-avatar"
import TaskLifetimeChart from "@components/task/task-lifetime-chart"
import TaskPageHeader from "@components/task/task-page-header"
import { Skeleton } from "@components/ui/skeleton"
import { useTaskWorkflow } from "@hooks/use-task-workflow"
import { useNow } from "@hooks/use-now"
import { formatDurationExact } from "@utils/format-duration-exact"
import { computeTaskPhases } from "@utils/task-phases"
import { parseTask, parseWorkflow, type Task } from "@/types/surreal-records"
import { useTourChangeStepOnLoad } from "@stores/use-tour-store"
import WorkflowGraph, { WorkflowChartType } from "@components/workflow/workflow-graph"
import React, { useMemo } from "react"

const formatDateTime = (date?: Date) => (date ? date.toLocaleString() : "---")

const safeParseJson = (value?: string) => {
  if (!value) return undefined
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

const TaskLink = ({ task }: { task: Task }) => (
  <Link to="/tasks/$taskId" params={{ taskId: task.id }} className="text-primary underline hover:opacity-80">
    {task.type || task.id}
  </Link>
)

const ExecutionPanel = ({ task }: { task: Task }) => {
  const now = useNow(1000)
  const phases = useMemo(() => computeTaskPhases(task, now), [now, task])
  const queueWait = phases.find((phase) => phase.label === "Waiting in Queue")?.durationMs
  const workerWait = phases.find((phase) => phase.label === "Waiting in Worker")?.durationMs
  const runtime = phases.find((phase) => phase.label === "Running")?.durationMs

  return (
    <Panel title="Execution">
      <div className="grid gap-2 p-3 md:grid-cols-2">
        <DetailItem label="State" value={task.state} />
        <DetailItem label="Retries" value={task.retries ?? 0} />
        <DetailItem label="Queue wait" value={queueWait ? formatDurationExact(queueWait) : "---"} />
        <DetailItem label="Worker wait" value={workerWait ? formatDurationExact(workerWait) : "---"} />
        <DetailItem label="Runtime" value={runtime ? formatDurationExact(runtime) : "---"} />
        <DetailItem
          label="Worker"
          value={
            task.worker ? (
              <Link
                to="/workers/$workerId"
                params={{ workerId: task.worker }}
                className="text-primary underline hover:opacity-80"
              >
                {task.worker}
              </Link>
            ) : (
              "---"
            )
          }
        />
        <DetailItem label="Sent" value={formatDateTime(task.sent_at)} />
        <DetailItem label="Received" value={formatDateTime(task.received_at)} />
        <DetailItem label="Started" value={formatDateTime(task.started_at)} />
        <DetailItem label="Finished" value={formatDateTime(task.succeeded_at || task.failed_at || task.retried_at)} />
      </div>
    </Panel>
  )
}

const InputsPanel = ({ task }: { task: Task }) => (
  <Panel title="Inputs">
    <div className="space-y-3 p-3">
      <div className="grid gap-2 md:grid-cols-2">
        <DetailItem label="ETA" value={task.eta || "---"} />
        <DetailItem label="Expires" value={task.expires || "---"} />
      </div>
      <JsonViewThemed
        value={{
          args: safeParseJson(task.args) ?? task.args ?? "Unknown",
          kwargs: safeParseJson(task.kwargs) ?? task.kwargs ?? "Unknown",
        }}
      />
    </div>
  </Panel>
)

const OutcomePanel = ({ task }: { task: Task }) => (
  <Panel title="Outcome">
    <div className="space-y-3 p-3">
      <div className="grid gap-2 md:grid-cols-2">
        <DetailItem label="Truncated" value={task.result_truncated ? "Yes" : "No"} />
        <DetailItem label="Exception" value={task.exception || "---"} />
      </div>
      <JsonViewThemed
        value={{
          result: safeParseJson(task.result) ?? task.result ?? null,
          exception: task.exception ?? null,
          traceback: task.traceback ?? null,
        }}
      />
    </div>
  </Panel>
)

const DeliveryPanel = ({ task }: { task: Task }) => (
  <Panel title="Delivery">
    <div className="grid gap-2 p-3 md:grid-cols-2">
      <DetailItem label="Exchange" value={task.exchange || "---"} />
      <DetailItem label="Routing key" value={task.routing_key || "---"} />
      <DetailItem label="Root task" value={task.root_id || task.id} />
      <DetailItem label="Parent task" value={task.parent_id || "---"} />
    </div>
  </Panel>
)

const RelatedTasksPanel = ({ currentTask, members }: { currentTask: Task; members: Task[] }) => {
  const parent = members.find((task) => task.id === currentTask.parent_id)
  const children = members.filter((task) => currentTask.children.includes(task.id)).slice(0, 4)
  const siblings = members
    .filter((task) => task.parent_id === currentTask.parent_id && task.id !== currentTask.id)
    .sort((left, right) => new Date(right.last_updated).getTime() - new Date(left.last_updated).getTime())
    .slice(0, 4)

  return (
    <Panel title="Related Tasks">
      <div className="space-y-3 p-3">
        <div>
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Parent</p>
          <div>{parent ? <TaskLink task={parent} /> : "---"}</div>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Children</p>
          <div className="flex flex-wrap gap-2">
            {children.length ? children.map((task) => <TaskLink key={task.id} task={task} />) : "---"}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Notable siblings</p>
          <div className="flex flex-wrap gap-2">
            {siblings.length ? siblings.map((task) => <TaskLink key={task.id} task={task} />) : "---"}
          </div>
        </div>
      </div>
    </Panel>
  )
}

const TaskPage = () => {
  const { taskId } = Route.useParams()
  const { task: surrealTask, workflow: surrealWorkflow, members, isLoading } = useTaskWorkflow(taskId)
  const task = useMemo(() => (surrealTask ? parseTask(surrealTask) : undefined), [surrealTask])
  const workflow = useMemo(() => (surrealWorkflow ? parseWorkflow(surrealWorkflow) : undefined), [surrealWorkflow])
  const parsedMembers = useMemo(() => members.map(parseTask), [members])
  const [chartType, setChartType] = React.useState<WorkflowChartType>(WorkflowChartType.FLOWCHART)
  useTourChangeStepOnLoad(2, task !== undefined)

  if (!isLoading && task === undefined) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <div className="flex items-center">
          <TaskAvatar taskId={taskId} type={undefined} />
          <h2 className="ml-2 text-2xl font-semibold">Could not find this task</h2>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="h-[50vh] w-full" id="workflow-chart">
        {task ? (
          <WorkflowGraph
            chartType={chartType}
            workflowId={task.workflow_id || task.root_id || task.id}
            rootTaskId={workflow?.root_task_id || task.root_id || task.id}
            currentTaskId={task.id}
          />
        ) : (
          <Skeleton className="h-[450px] w-full" />
        )}
      </div>
      <TaskPageHeader task={task} chartType={chartType} setChartType={setChartType} />
      <div className="py-2 px-4" id="lifetime-chart">
        {task ? <TaskLifetimeChart task={task} /> : <Skeleton className="h-8 w-full rounded-md" />}
      </div>
      <TaskAlerts taskId={taskId} />
      {task ? (
        <div className="grid grid-cols-1 gap-3 px-3 py-2 lg:grid-cols-4" id="task-details">
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <ExecutionPanel task={task} />
              <InputsPanel task={task} />
              <OutcomePanel task={task} />
              <DeliveryPanel task={task} />
            </div>
          </div>
          <div className="lg:col-span-1">
            <RelatedTasksPanel currentTask={task} members={parsedMembers} />
          </div>
        </div>
      ) : (
        <div className="px-3">
          <Skeleton className="h-64 w-full" />
        </div>
      )}
    </div>
  )
}

export const Route = createFileRoute("/tasks/$taskId")({
  component: TaskPage,
})
