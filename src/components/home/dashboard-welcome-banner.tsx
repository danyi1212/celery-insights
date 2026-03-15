import { Button } from "@components/ui/button"
import useSettingsStore from "@stores/use-settings-store"
import { startTour } from "@stores/use-tour-store"
import { BookOpenText, Sparkles, X } from "lucide-react"
import React from "react"

interface DashboardWelcomeBannerProps {
  isDemo: boolean
}

const DashboardWelcomeBanner: React.FC<DashboardWelcomeBannerProps> = ({ isDemo }) => (
  <div className="mx-6 mt-6 rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/10 via-background to-status-info/10 p-5 shadow-sm">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 rounded-2xl bg-primary/15 p-3 text-primary">
          <Sparkles className="size-5" />
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">Start with the guided tour</h2>
            {isDemo && (
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Demo mode
              </span>
            )}
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Learn where workflow activity, failures, and worker context show up. Celery Insights becomes useful once
            task events are flowing, so the tour stays visible until the dashboard has real activity.
          </p>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span className="rounded-full bg-background/80 px-3 py-1">Enable Celery task events</span>
            <span className="rounded-full bg-background/80 px-3 py-1">Inspect full workflows in one click</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 self-start">
        <Button onClick={() => startTour()}>Start Tour</Button>
        <Button variant="ghost" asChild>
          <a href="/documentation/setup" className="gap-2">
            <BookOpenText className="size-4" />
            Setup
          </a>
        </Button>
        <Button variant="ghost" size="icon" onClick={() => useSettingsStore.setState({ hideWelcomeBanner: true })}>
          <X className="size-4" />
        </Button>
      </div>
    </div>
  </div>
)

export default DashboardWelcomeBanner
