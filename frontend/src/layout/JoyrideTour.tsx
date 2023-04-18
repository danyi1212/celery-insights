import TourTooltip from "@layout/TourTooltip"
import { backStep, nextStep, stopTour, useTourStore } from "@stores/useTourStore"
import React, { useMemo } from "react"
import Joyride, { ACTIONS, CallBackProps, EVENTS, LIFECYCLE, STATUS, Step } from "react-joyride"

const createSteps = (): Step[] => [
    {
        target: "body",
        placement: "center",
        title: "Let's Start",
        content: (
            <span>
                Open your app and trigger a Celery task or workflow.
                <br />
                We will use it to get some insights
            </span>
        ),
        disableBeacon: true,
    },
    {
        target: "#recent-tasks",
        placement: "top",
        placementBeacon: "top",
        title: "Find your task",
        content: (
            <span>
                Here you can see a feed of the latest tasks in your Celery cluster.
                <br />
                Look up and click on one of the tasks from the workflow you&apos;ve triggered.
            </span>
        ),
        isFixed: true,
        disableScrolling: true,
        spotlightClicks: true,
        hideFooter: true,
    },
    {
        target: "#task-header",
        placement: "bottom-start",
        title: "Follow your task",
        content: (
            <>
                <p>
                    Every task is assigned a unique Avatar, with a figure generated based on its ID, while the
                    background color of the Avatar reflects the task type, allowing you to follow it around.
                </p>
                <p>
                    Keep track of task status with the badge icon on the side, which updates in real-time to show
                    progress.
                </p>
            </>
        ),
        isFixed: true,
        disableScrolling: true,
        spotlightClicks: true,
        disableBeacon: true,
    },
    {
        target: "#workflow-chart",
        placement: "center",
        title: "Understand the context",
        content: (
            <span>
                Here you can see the complete workflow containing this task.
                <br />
                Try clicking on other tasks in the workflow to check them out.
            </span>
        ),
        isFixed: true,
        disableScrolling: true,
        spotlightClicks: true,
        disableBeacon: true,
    },
]

const JoyrideTour: React.FC = () => {
    const state = useTourStore()
    const steps = useMemo(() => createSteps(), [])

    /* eslint-disable no-console */
    const handleCallback = (data: CallBackProps) => {
        console.groupCollapsed(data.type, data.action, data.lifecycle)
        console.log(data)
        console.log(state)

        if (data.type == EVENTS.STEP_AFTER || data.type == EVENTS.TARGET_NOT_FOUND) {
            if (data.action === ACTIONS.PREV) backStep()
            else nextStep()
        } else if (
            data.lifecycle === LIFECYCLE.COMPLETE ||
            data.action === ACTIONS.RESET ||
            data.status === STATUS.SKIPPED
        ) {
            stopTour()
        }
        console.log(useTourStore.getState())
        console.groupEnd()
    }
    /* eslint-enable no-console */

    return (
        <Joyride
            steps={steps}
            callback={handleCallback}
            run={state.run}
            stepIndex={state.stepIndex}
            continuous
            scrollToFirstStep
            disableOverlayClose
            tooltipComponent={TourTooltip}
        />
    )
}
export default JoyrideTour
