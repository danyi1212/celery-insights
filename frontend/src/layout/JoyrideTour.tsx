import TourTooltip from "@layout/TourTooltip"
import { useTheme } from "@mui/material"
import { backStep, nextStep, stopTour, useTourStore } from "@stores/useTourStore"
import React, { useMemo } from "react"
import Joyride, { ACTIONS, CallBackProps, EVENTS, LIFECYCLE, STATUS, Step } from "react-joyride"

const createSteps = (): Step[] => [
    {
        // step index 0
        target: "body",
        placement: "center",
        title: "Getting Started",
        content: (
            <span>
                Open your app and trigger a Celery task or workflow.
                <br />
                We will use it to get some insights.
            </span>
        ),
        disableBeacon: true,
    },
    {
        // step index 1
        target: "#recent-tasks",
        placement: "top",
        placementBeacon: "top",
        title: "Locate Your Task",
        content: (
            <span>
                In this feed, you&apos;ll find the latest tasks in your Celery cluster.
                <br />
                Locate and click on one of the tasks from the workflow you&apos;ve triggered.
            </span>
        ),
        isFixed: true,
        disableScrolling: true,
        spotlightClicks: true,
        hideFooter: true, // Disable the next button (automatic on navigation)
    },
    {
        // step index 2
        target: "#task-header",
        placement: "bottom-start",
        title: "Follow Your Task",
        content: (
            <p>
                Each task has a unique Avatar, generated from its ID. <br />
                The background color represents the task type, making it easy to track. <br />
                Monitor the task status with the badge icon, which updates in real-time.
            </p>
        ),
        isFixed: true,
        disableScrolling: true,
        disableBeacon: true,
        hideBackButton: true,
    },
    {
        // step index 3
        target: "#workflow-chart",
        placement: "bottom",
        title: "Understanding Task Relationships",
        content: (
            <span>
                This chart presents the entire workflow that includes your task, helping you understand the
                relationships between tasks.
                <br />
                Click on other tasks within the workflow to check them out.
            </span>
        ),
        isFixed: true,
        disableScrolling: true,
        spotlightClicks: true,
    },
    {
        // step index 4
        target: "#workflow-selector",
        placement: "left",
        title: "Switch to Timeline view",
        content: "To see when each task started and finished, switch to the timeline view.",
        isFixed: true,
        disableScrolling: true,
        spotlightClicks: true,
        hideFooter: true,
    },
    {
        // step index 5
        target: "#workflow-chart",
        placement: "bottom",
        title: "Analyze the timeline",
        content:
            "The timeline chart view allows you to see the start and finish times of each task, as well as the " +
            "duration. The white line indicates when the task was sent.",
        isFixed: true,
        disableScrolling: true,
        spotlightClicks: true,
    },
    {
        // step index 6
        target: "#lifetime-chart",
        placement: "bottom",
        title: "Task Lifetime",
        content:
            "The lifetime chart shows the changes in task status over time, giving you a glimpse of how long " +
            "the task remained in each stage.",
        isFixed: true,
        spotlightClicks: true,
    },
    {
        // step index 7
        target: "#task-details",
        placement: "top",
        title: "Explore Task Details",
        content: (
            <>
                <p>
                    In this part, you can explore more about the task, with delivery information, the arguments, and the
                    task&apos;s result.
                </p>
                <p>Let&apos;s dive deeper, click on the worker name.</p>
            </>
        ),
        isFixed: true,
        spotlightClicks: true,
        hideFooter: true,
    },
    {
        // step index 8
        target: "#worker-details",
        placement: "bottom",
        title: "Examine Worker Details",
        content: "This section provides information about the worker.",
        isFixed: true,
        disableScrolling: true,
        disableBeacon: true,
        spotlightClicks: true,
        hideBackButton: true,
    },
    {
        // step index 9
        target: "#worker-pool",
        placement: "bottom",
        title: "Inspect Worker Pool",
        content: (
            <span>
                Each worker has a pool of processes that handle tasks. <br />
                Observe each active process in the pool, with the icon changing to the avatar of the task being
                processed.
            </span>
        ),
        isFixed: true,
        disableScrolling: true,
        spotlightClicks: true,
    },
    {
        // step index 10
        target: "#registered-tasks",
        placement: "top",
        title: "Explore Task Types",
        content: (
            <>
                <p>
                    This list shows the task types the worker can execute. The badge next to each task indicates the
                    number of tasks executed.
                </p>
                <p>Click on a task with a badge to explore further.</p>
            </>
        ),
        isFixed: true,
        spotlightClicks: true,
        hideFooter: true,
    },
    {
        // step index 11
        target: "body",
        placement: "center",
        title: "Discover the Explorer",
        content: "Use the Explorer to search for tasks and compare them.",
        isFixed: true,
        disableBeacon: true,
        hideBackButton: true,
    },
    {
        // step index 12
        target: "#facets-menu",
        placement: "right-start",
        title: "Refine Your Search",
        content: (
            <span>
                Facets display unique values and counts for each task property. <br />
                Select these values to refine your search, and the table will show only tasks matching the selected
                criteria.
            </span>
        ),
        isFixed: true,
        spotlightClicks: true,
    },
    {
        // step index 13
        target: "body",
        placement: "center",
        title: "You're all set!!",
        content: "Thank you for choosing Celery Insights. Enjoy your exploration journey!",
        isFixed: true,
    },
]

const JoyrideTour: React.FC = () => {
    const theme = useTheme()
    const state = useTourStore()
    const steps = useMemo(() => createSteps(), [])

    /* eslint-disable no-console */
    const handleCallback = (data: CallBackProps) => {
        console.groupCollapsed(data.type, data.action, data.lifecycle)
        console.log(data)
        console.log(state)

        if (data.type == EVENTS.STEP_AFTER) {
            if (data.action === ACTIONS.PREV) backStep()
            else if (!data.step.hideFooter) nextStep() // Don't increment on steps with next disabled
        } else if (
            data.type == EVENTS.TARGET_NOT_FOUND ||
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
            spotlightPadding={0}
            styles={{
                options: {
                    arrowColor: theme.palette.background.paper,
                    backgroundColor: theme.palette.background.paper,
                    primaryColor: theme.palette.primary.main,
                    textColor: theme.palette.text.primary,
                    zIndex: theme.zIndex.tooltip,
                },
            }}
        />
    )
}
export default JoyrideTour
