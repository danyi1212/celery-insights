import { createFileRoute } from "@tanstack/react-router"
import DashboardWelcomeBanner from "@components/home/dashboard-welcome-banner"
import FailureInbox from "@components/home/failure-inbox"
import TaskCountChartPanel from "@components/home/task-count-chart-panel"
import WorkflowActivityFeed from "@components/task/workflow-activity-feed"
import WorkersSummaryStack from "@components/worker/workers-summary-stack"
import useSettingsStore from "@stores/use-settings-store"
import { useSurrealDB } from "@components/surrealdb-provider"
import { useHomepageSummary } from "@hooks/use-homepage-summary"
import { useOnlineWorkers } from "@hooks/use-live-workers"
import { AlertCircle, Loader2 } from "lucide-react"

const HomePage = () => {
  const hideWelcomeBanner = useSettingsStore((state) => state.hideWelcomeBanner)
  const isDemo = useSettingsStore((state) => state.demo)
  const { status, error } = useSurrealDB()
  const { data: summary } = useHomepageSummary()
  const { data: workers } = useOnlineWorkers()
  if (status !== "connected") {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        {status === "connecting" ? (
          <Loader2 className="size-8 animate-spin text-primary" />
        ) : (
          <>
            <div className="mb-4 flex items-center">
              <AlertCircle className="mr-3 size-10 text-destructive" />
              <h3 className="text-3xl font-semibold">Unable to connect to the database</h3>
            </div>
            <ul className="text-xl">
              <li>Make sure you are connected to the network</li>
              <li>Check the server logs for any error messages or issues</li>
              <li>Try restarting the server</li>
            </ul>
            {error && <p className="mt-4 text-sm text-muted-foreground">{error.message}</p>}
          </>
        )}
      </div>
    )
  }

  const hasActivity = summary.recentTaskCount > 0 || Boolean(summary.latestTaskUpdatedAt) || workers.length > 0
  const showWelcomeBanner = !hideWelcomeBanner && (isDemo || !hasActivity)

  return (
    <div className="pb-6">
      {showWelcomeBanner && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <DashboardWelcomeBanner isDemo={isDemo} />
        </div>
      )}
      <div className="grid grid-cols-12 items-start gap-3 px-5 pt-4">
        <div className="col-span-12 xl:col-span-8">
          <WorkflowActivityFeed id="recent-tasks" />
        </div>
        <div className="col-span-12 space-y-3 xl:col-span-4">
          <TaskCountChartPanel />
          <FailureInbox />
          <WorkersSummaryStack />
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/")({
  component: HomePage,
})
