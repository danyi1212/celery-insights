import DetailItem from "@components/common/detail-item"
import Panel from "@components/common/panel"
import TaskStateBadge from "@components/task/task-state-badge"
import { useNow } from "@hooks/use-now"
import { Link } from "@tanstack/react-router"
import { formatDurationExact } from "@utils/format-duration-exact"
import { getTaskExecution } from "@utils/task-execution"
import { computeTaskPhases } from "@utils/task-phases"
import { TaskState, type Task } from "@/types/surreal-records"
import React, { useMemo } from "react"

const formatDateTime = (date?: Date) => (date ? date.toLocaleString() : "---")

const TaskExecutionPanel: React.FC<{ task: Task }> = ({ task }) => {
  const now = useNow(1000)
  const phases = useMemo(() => computeTaskPhases(task, now), [now, task])
  const queueWait = phases.find((phase) => phase.kind === "queue")?.durationMs
  const workerWait = phases.find((phase) => phase.kind === "worker")?.durationMs
  const runtime = phases.find((phase) => phase.kind === "running")?.durationMs
  const runtimeUnconfirmed = task.state === TaskState.STARTED && getTaskExecution(task, now.getTime()) !== "active"

  return (
    <Panel title="Execution">
      <div className="grid gap-2 p-3 md:grid-cols-2">
        <DetailItem label="Reported state" value={<TaskStateBadge state={task.state} execution={task} />} />
        <DetailItem label="Last worker inspection" value={formatDateTime(task.execution_observed_at)} />
        <DetailItem label="Retries" value={task.retries ?? 0} />
        <DetailItem label="Queue wait" value={queueWait ? formatDurationExact(queueWait) : "---"} />
        <DetailItem label="Worker wait" value={workerWait ? formatDurationExact(workerWait) : "---"} />
        <DetailItem
          label={runtimeUnconfirmed ? "Runtime unconfirmed" : "Runtime"}
          value={runtime ? formatDurationExact(runtime) : "---"}
        />
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

export default TaskExecutionPanel
