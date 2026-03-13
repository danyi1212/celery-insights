import { createFileRoute } from "@tanstack/react-router"
import BrokerDetailsCard from "@components/worker/panels/broker-details-card"
import PoolDetailsCard from "@components/worker/panels/pool-details-card"
import QueueDetails from "@components/worker/panels/queue-details"
import ActiveTasksPanel from "@components/worker/panels/tasks/active-tasks-panel"
import RegisteredTasksPanel from "@components/worker/panels/tasks/registered-tasks-panel"
import ReservedTasksPanel from "@components/worker/panels/tasks/reserved-tasks-panel"
import RevokedTasksPanel from "@components/worker/panels/tasks/revoked-tasks-panel"
import ScheduledTasksPanel from "@components/worker/panels/tasks/scheduled-tasks-panel"
import WorkerDetailsCard from "@components/worker/panels/worker-details-card"
import { AlertCircle } from "lucide-react"
import { useWorker } from "@hooks/use-live-workers"
import { useTourChangeStepOnLoad } from "@stores/use-tour-store"

const WorkerPage = () => {
    const { workerId } = Route.useParams()
    const { worker, isLoading } = useWorker(workerId)
    const notFound = !isLoading && worker === null
    useTourChangeStepOnLoad(8, !notFound)

    if (notFound)
        return (
            <div className="flex h-full flex-col items-center justify-center">
                <div className="flex items-center">
                    <AlertCircle className="size-8 text-status-warning" />
                    <h2 className="ml-2 text-2xl font-semibold">Could not find worker {workerId}</h2>
                </div>
            </div>
        )

    return (
        <div className="grid grid-cols-12 gap-3 px-3">
            <div className="col-span-12 lg:col-span-6 xl:col-span-4">
                <WorkerDetailsCard workerId={workerId} id="worker-details" />
            </div>
            <div className="col-span-12 lg:col-span-6 xl:col-span-4">
                <BrokerDetailsCard workerId={workerId} />
            </div>
            <div className="col-span-12 lg:col-span-6 xl:col-span-4">
                <PoolDetailsCard workerId={workerId} id="worker-pool" />
            </div>
            <div className="col-span-12">
                <QueueDetails workerId={workerId} />
            </div>
            <div className="col-span-12 lg:col-span-6 xl:col-span-4">
                <ActiveTasksPanel workerId={workerId} />
            </div>
            <div className="col-span-12 lg:col-span-6 xl:col-span-4">
                <ReservedTasksPanel workerId={workerId} />
            </div>
            <div className="col-span-12 lg:col-span-6 xl:col-span-4">
                <ScheduledTasksPanel workerId={workerId} />
            </div>
            <div className="col-span-12 xl:col-span-6">
                <RegisteredTasksPanel workerId={workerId} id="registered-tasks" />
            </div>
            <div className="col-span-12 xl:col-span-6">
                <RevokedTasksPanel workerId={workerId} />
            </div>
        </div>
    )
}

export const Route = createFileRoute("/workers/$workerId")({
    component: WorkerPage,
})
