import WorkerSummary from "@components/worker/WorkerSummary"
import { useOnlineWorkerIds } from "@hooks/worker/useOnlineWorkerIds"
import React from "react"

const WorkersSummaryStack: React.FC = () => {
    const workerIds = useOnlineWorkerIds()

    return (
        <div>
            <div className="flex min-h-16 items-center px-4">
                <h4 className="truncate text-2xl font-semibold">Online Workers</h4>
            </div>
            {workerIds.length ? (
                <div className="flex flex-col gap-5">
                    {workerIds.map((workerId) => (
                        <WorkerSummary key={workerId} workerId={workerId} />
                    ))}
                </div>
            ) : (
                <div className="my-10 text-center">
                    <h4 className="mb-4 text-2xl font-semibold">No online workers</h4>
                    <span>Start a Celery worker to see it here</span>
                </div>
            )}
        </div>
    )
}
export default WorkersSummaryStack
