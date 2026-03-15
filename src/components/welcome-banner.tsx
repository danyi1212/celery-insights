import BannerFlowchart from "@components/banner-flowchart"
import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import useSettingsStore from "@stores/use-settings-store"
import { startTour } from "@stores/use-tour-store"
import { ArrowRight, X } from "lucide-react"
import React from "react"
import { ReactFlowProvider } from "@xyflow/react"

const WelcomeBanner: React.FC = () => {
  return (
    <ReactFlowProvider>
      <div className="banner-gradient pointer-events-none relative m-6 h-[450px] overflow-hidden rounded-3xl">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="pointer-events-auto absolute right-4 top-2"
              onClick={() => useSettingsStore.setState({ hideWelcomeBanner: true })}
            >
              <X className="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Hide banner</TooltipContent>
        </Tooltip>
        <div className="pointer-events-auto absolute left-20 top-[60px]">
          <h1 className="mb-4 text-[5rem] font-bold leading-tight">Welcome to Celery&nbsp;Insights!</h1>
          <h4 className="mb-4 text-2xl">The ultimate monitoring tool for your cluster.</h4>
          <div className="my-6 flex gap-4">
            <Button variant="secondary" size="lg" onClick={() => startTour()}>
              Start Tour
            </Button>
            <a
              href="https://github.com/danyi1212/celery-insights"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-6 text-lg text-secondary transition-colors hover:text-secondary/80"
            >
              Getting Started <ArrowRight className="size-6" />
            </a>
          </div>
        </div>
        <BannerFlowchart />
      </div>
    </ReactFlowProvider>
  )
}
export default WelcomeBanner
