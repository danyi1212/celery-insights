import { appUrl } from "@lib/app-url"
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
            Explore tasks, workflows and workers. Connect your cluster and enable task events to see live activity.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 self-start">
        <Button onClick={() => startTour()}>Start Tour</Button>
        <Button variant="ghost" asChild>
          <a href={appUrl("/documentation/setup")} className="gap-2">
            <BookOpenText className="size-4" />
            Setup
          </a>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Hide welcome banner"
          onClick={() => useSettingsStore.setState({ hideWelcomeBanner: true })}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  </div>
)

export default DashboardWelcomeBanner
