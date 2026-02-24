import ErrorAlert from "@components/errors/error-alert"
import QueueDetailsPanel from "@components/worker/panels/queue-details-panel"
import useWorkerQueues from "@hooks/worker/use-worker-queues"
import { Loader2 } from "lucide-react"
import React from "react"

interface QueueDetailsProps {
    hostname: string
}

const QueueDetails: React.FC<QueueDetailsProps> = ({ hostname }) => {
    const { queues, isLoading, error } = useWorkerQueues(hostname)
    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="size-8 animate-spin text-primary" />
            </div>
        )
    }
    if (error) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <ErrorAlert error={error} />
            </div>
        )
    }
    if (!queues || !queues.length) {
        return <h3 className="p-3 text-center text-2xl font-semibold">No Queues Connected</h3>
    }
    return (
        <div className="grid grid-cols-12 gap-3 px-3">
            {queues.map((queue) => (
                <div className="col-span-12 sm:col-span-6 lg:col-span-4 xl:col-span-3" key={queue.name}>
                    <QueueDetailsPanel queue={queue} />
                </div>
            ))}
        </div>
    )
}

export default QueueDetails
