import WorkerSummary from "@components/worker/worker-summary"
import { useOnlineWorkers } from "@hooks/use-live-workers"
import { extractId } from "@/types/surreal-records"
import React from "react"
import { Server } from "lucide-react"
import { Button } from "@components/ui/button"

const WorkersSummaryStack: React.FC = () => {
    const { data: workers } = useOnlineWorkers()
    const [expanded, setExpanded] = React.useState(false)
    const visibleWorkers = expanded ? workers : workers.slice(0, 5)
    const remainingCount = Math.max(workers.length - visibleWorkers.length, 0)

    return (
        <div className="rounded-3xl border border-border/70 bg-card/95 p-3">
            <div className="mb-2.5 flex min-h-9 items-center justify-between gap-3">
                <div>
                    <h4 className="truncate text-lg font-semibold">Worker Context</h4>
                    <p className="text-xs text-muted-foreground">Who is processing work right now.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-xs">
                    <Server className="size-3.5 text-primary" />
                    {workers.length} online
                </div>
            </div>
            {workers.length ? (
                <div className="flex flex-col gap-3">
                    {visibleWorkers.map((worker) => {
                        const workerId = extractId(worker.id)
                        return <WorkerSummary key={workerId} workerId={workerId} />
                    })}
                    {workers.length > 5 && (
                        <Button variant="outline" className="w-full" onClick={() => setExpanded((value) => !value)}>
                            {expanded ? "Show Fewer Workers" : `Show ${remainingCount} More Workers`}
                        </Button>
                    )}
                </div>
            ) : (
                <div className="my-10 text-center">
                    <h4 className="mb-4 text-2xl font-semibold">No online workers</h4>
                    <span className="text-muted-foreground">Start a Celery worker to see it here.</span>
                </div>
            )}
        </div>
    )
}
export default WorkersSummaryStack
