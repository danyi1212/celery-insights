import DetailItem from "@components/common/DetailItem"
import Panel from "@components/common/Panel"
import ProcessChip from "@components/worker/panels/ProcessChip"
import useWorkerActiveTasks from "@hooks/worker/useWorkerActiveTasks"
import useWorkerStats from "@hooks/worker/useWorkerStats"
import Grid from "@mui/material/Grid"
import { TaskRequest } from "@services/server"
import { formatSecondsDuration } from "@utils/formatSecondsDuration"
import React, { startTransition, useEffect, useState } from "react"

interface PoolDetailsCardProps {
    hostname: string
}

function useTaskProcessMap(hostname: string): Map<number, TaskRequest> {
    const { tasks } = useWorkerActiveTasks(hostname)
    const [map, setMap] = useState<Map<number, TaskRequest>>(new Map())

    useEffect(
        () =>
            startTransition(() => {
                const map = new Map<number, TaskRequest>()
                tasks?.forEach((task) => {
                    if (task.worker_pid != null) {
                        map.set(task.worker_pid, task)
                    }
                })
                setMap(map)
            }),
        [tasks]
    )

    return map
}

const PoolDetailsCard: React.FC<PoolDetailsCardProps> = ({ hostname }) => {
    const { stats, isLoading, error } = useWorkerStats(hostname)
    const taskProcessMap = useTaskProcessMap(hostname)

    return (
        <Panel title="Process Pool" loading={isLoading} error={error}>
            <Grid container spacing={2} p={2}>
                <Grid item xs={12} md={6}>
                    <DetailItem
                        label="Max Concurrency"
                        description="Maximum number of child parallelism (processes/threads)"
                        value={stats?.pool["max-concurrency"]}
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem
                        label="Recycle Limit"
                        description="Maximum number of tasks to be executed before child recycled"
                        value={stats?.pool["max-tasks-per-child"]}
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem label="Soft Timeout" value={formatSecondsDuration(stats?.pool.timeouts[0] || 0)} />
                </Grid>
                <Grid item xs={12} md={6}>
                    <DetailItem label="Hard Timeout" value={formatSecondsDuration(stats?.pool.timeouts[1] || 0)} />
                </Grid>
                <Grid item xs={12}>
                    <Grid container direction="row" spacing={0.5}>
                        {stats?.pool.processes.map((process) => (
                            <Grid item key={process} xs={3}>
                                <ProcessChip processId={process} task={taskProcessMap.get(process)} />
                            </Grid>
                        ))}
                    </Grid>
                </Grid>
            </Grid>
        </Panel>
    )
}

export default PoolDetailsCard
