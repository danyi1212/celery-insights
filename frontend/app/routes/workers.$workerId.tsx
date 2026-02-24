import { createFileRoute } from "@tanstack/react-router"
import BrokerDetailsCard from "@components/worker/panels/BrokerDetailsCard"
import PoolDetailsCard from "@components/worker/panels/PoolDetailsCard"
import QueueDetails from "@components/worker/panels/QueueDetails"
import ActiveTasksPanel from "@components/worker/panels/tasks/ActiveTasksPanel"
import RegisteredTasksPanel from "@components/worker/panels/tasks/RegisteredTasksPanel"
import ReservedTasksPanel from "@components/worker/panels/tasks/ReservedTasksPanel"
import RevokedTasksPanel from "@components/worker/panels/tasks/RevokedTasksPanel"
import ScheduledTasksPanel from "@components/worker/panels/tasks/ScheduledTasksPanel"
import WorkerDetailsCard from "@components/worker/panels/WorkerDetailsCard"
import { AlertCircle } from "lucide-react"
import { useStateStore } from "@stores/useStateStore"
import { useTourChangeStepOnLoad } from "@stores/useTourStore"
import { useCallback, useMemo } from "react"

const WorkerPage = () => {
    const { workerId } = Route.useParams()
    const hostname = useMemo(() => workerId.substring(0, workerId.lastIndexOf("-")), [workerId])
    const notFound = useStateStore(useCallback((state) => !state.workers.has(workerId), [workerId]))
    useTourChangeStepOnLoad(8, !notFound)

    if (notFound)
        return (
            <div className="flex h-full flex-col items-center justify-center">
                <div className="flex items-center">
                    <AlertCircle className="size-8 text-amber-500" />
                    <h2 className="ml-2 text-2xl font-semibold">Could not find worker {workerId}</h2>
                </div>
            </div>
        )

    return (
        <div className="grid grid-cols-12 gap-3 px-3">
            <div className="col-span-12 lg:col-span-6 xl:col-span-4">
                <WorkerDetailsCard workerId={workerId} hostname={hostname} id="worker-details" />
            </div>
            <div className="col-span-12 lg:col-span-6 xl:col-span-4">
                <BrokerDetailsCard hostname={hostname} />
            </div>
            <div className="col-span-12 lg:col-span-6 xl:col-span-4">
                <PoolDetailsCard hostname={hostname} id="worker-pool" />
            </div>
            <div className="col-span-12">
                <QueueDetails hostname={hostname} />
            </div>
            <div className="col-span-12 lg:col-span-6 xl:col-span-4">
                <ActiveTasksPanel hostname={hostname} />
            </div>
            <div className="col-span-12 lg:col-span-6 xl:col-span-4">
                <ReservedTasksPanel hostname={hostname} />
            </div>
            <div className="col-span-12 lg:col-span-6 xl:col-span-4">
                <ScheduledTasksPanel hostname={hostname} />
            </div>
            <div className="col-span-12 xl:col-span-6">
                <RegisteredTasksPanel workerId={workerId} hostname={hostname} id="registered-tasks" />
            </div>
            <div className="col-span-12 xl:col-span-6">
                <RevokedTasksPanel hostname={hostname} />
            </div>
        </div>
    )
}

export const Route = createFileRoute("/workers/$workerId")({
    component: WorkerPage,
})
