import { X } from "lucide-react"
import { Button } from "@components/ui/button"
import { Card, CardContent, CardFooter } from "@components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import useSettingsStore from "@stores/use-settings-store"
import { useLiveTasks } from "@hooks/use-live-tasks"
import { useTourStore } from "@stores/use-tour-store"
import React from "react"
import { TooltipRenderProps } from "react-joyride"

const TourTooltip: React.FC<TooltipRenderProps> = ({
  index,
  step,
  tooltipProps,
  primaryProps,
  backProps,
  skipProps,
  closeProps,
  isLastStep,
}) => {
  const { data: tasks } = useLiveTasks(1)
  const hasTasks = tasks.length > 0
  const isDemo = useSettingsStore((state) => state.demo)
  return (
    <div className="animate-in zoom-in-75 fade-in duration-200">
      <Card {...tooltipProps} className="relative z-[1600] min-w-[250px] max-w-[650px] rounded-3xl py-0">
        <Button variant="ghost" size="icon-sm" className="absolute top-2 right-2" {...closeProps}>
          <X className="size-4" />
        </Button>
        <CardContent className="p-6 pb-0">
          <h2 className="text-2xl font-bold mb-1">{step.title}</h2>
          <div className="text-base py-1 break-words">{step.content}</div>
        </CardContent>
        <CardFooter className="justify-end gap-2 px-6 py-4">
          {index > 0 ? (
            <Button variant="ghost" disabled={[2, 8, 11].includes(index)} {...backProps}>
              Back
            </Button>
          ) : (
            <>
              <Button variant="ghost" className="text-secondary" {...skipProps}>
                Close
              </Button>
              {!isDemo && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      className="border-primary text-primary hover:bg-primary/10"
                      {...primaryProps}
                      onClick={(event) => {
                        useSettingsStore.setState({ demo: true })
                        useTourStore.setState({ demoMode: true })
                        primaryProps.onClick(event)
                      }}
                    >
                      Demo
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Start tour with Demo Mode</TooltipContent>
                </Tooltip>
              )}
            </>
          )}
          <Button
            variant={isLastStep ? "secondary" : "default"}
            disabled={step.hideFooter || !hasTasks}
            {...primaryProps}
          >
            {index > 0 ? (isLastStep ? "Finish" : "Next") : "Start"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
export default TourTooltip
