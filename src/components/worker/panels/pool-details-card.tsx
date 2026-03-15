import DetailItem from "@components/common/detail-item"
import Panel, { PanelProps } from "@components/common/panel"
import ProcessChip from "@components/worker/panels/process-chip"
import { useWorkerActiveTasks, useWorkerStats } from "@hooks/worker/use-worker-inspect"
import type { TaskRequest } from "@/types/surreal-records"
import { formatSecondsDuration } from "@utils/format-seconds-duration"
import React, { startTransition, useEffect, useState } from "react"

interface PoolDetailsCardProps extends Omit<PanelProps, "title"> {
  workerId: string
}

function useTaskProcessMap(workerId: string): Map<number, TaskRequest> {
  const { tasks } = useWorkerActiveTasks(workerId)
  const [map, setMap] = useState<Map<number, TaskRequest>>(new Map())

  useEffect(
    () =>
      startTransition(() => {
        const map = new Map<number, TaskRequest>()
        tasks?.forEach((task) => {
          if (task.worker_pid !== null && task.worker_pid !== undefined) {
            map.set(task.worker_pid, task)
          }
        })
        setMap(map)
      }),
    [tasks],
  )

  return map
}

const PoolDetailsCard: React.FC<PoolDetailsCardProps> = ({ workerId, ...props }) => {
  const { stats, isLoading, error } = useWorkerStats(workerId)
  const taskProcessMap = useTaskProcessMap(workerId)

  return (
    <Panel title="Process Pool" loading={isLoading} error={error} {...props}>
      <div className="grid grid-cols-12 gap-2 p-2">
        <div className="col-span-12 md:col-span-6">
          <DetailItem
            label="Max Concurrency"
            description="Maximum number of child parallelism (processes/threads)"
            value={stats?.pool?.["max-concurrency"] ?? "Unknown"}
          />
        </div>
        <div className="col-span-12 md:col-span-6">
          <DetailItem
            label="Recycle Limit"
            description="Maximum number of tasks to be executed before child recycled"
            value={stats?.pool?.["max-tasks-per-child"] ?? "Unknown"}
          />
        </div>
        <div className="col-span-12 md:col-span-6">
          <DetailItem label="Soft Timeout" value={formatSecondsDuration(stats?.pool?.timeouts?.[0] || 0)} />
        </div>
        <div className="col-span-12 md:col-span-6">
          <DetailItem label="Hard Timeout" value={formatSecondsDuration(stats?.pool?.timeouts?.[1] || 0)} />
        </div>
        <div className="col-span-12">
          <div className="grid grid-cols-4 gap-1">
            {stats?.pool?.processes?.map((process) => (
              <ProcessChip key={process} processId={process} task={taskProcessMap.get(process)} />
            ))}
          </div>
        </div>
      </div>
    </Panel>
  )
}

export default PoolDetailsCard
