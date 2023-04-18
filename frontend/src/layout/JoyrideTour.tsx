import TourTooltip from "@layout/TourTooltip"
import { useTheme } from "@mui/material"
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
        hideFooter: true, // Disable the next button (automatic on navigation)
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
        disableBeacon: true,
        hideBackButton: true,
    },
    {
        target: "#workflow-chart",
        placement: "bottom",
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
    },
    {
        target: "#workflow-selector",
        placement: "left",
        title: "Timeline view",
        content: (
            <span>
                Sometimes it is useful to see also when each task started and finished.
                <br />
                Switch to the timeline view.
            </span>
        ),
        isFixed: true,
        disableScrolling: true,
        spotlightClicks: true,
        hideFooter: true,
    },
    {
        target: "#workflow-chart",
        placement: "bottom",
        title: "Understand the timeline",
        content: (
            <>
                <p>
                    With the timeline chart view, you can easily see the start and finish time of each task in your
                    workflow, and get a clear picture of how long each task took to complete. The white line indicates
                    when it was sent.
                </p>
            </>
        ),
        isFixed: true,
        disableScrolling: true,
        spotlightClicks: true,
    },
    {
        target: "#lifetime-chart",
        placement: "bottom",
        title: "Task Lifetime",
        content:
            "The lifetime chart visualizes the changes in task status over time, " +
            "offering a glimpse into the length of time the task remained in each stage.",
        isFixed: true,
        spotlightClicks: true,
    },
    {
        target: "#task-details",
        placement: "top",
        title: "Delving into Details",
        content: (
            <>
                <p>
                    In this part, you can explore more about the task, with delivery information, the arguments, and the
                    task&apos;s result
                </p>
                <p>Lets dive deeper, click on the worker name</p>
            </>
        ),
        isFixed: true,
        spotlightClicks: true,
        hideFooter: true,
    },
    {
        target: "#worker-details",
        placement: "bottom",
        title: "Worker Details",
        content: "Here you can see information about the worker",
        isFixed: true,
        disableScrolling: true,
        disableBeacon: true,
        spotlightClicks: true,
        hideBackButton: true,
    },
    {
        target: "#worker-pool",
        placement: "bottom",
        title: "Worker Pool",
        content: (
            <>
                <p>Every worker has a pool of processes responsible for handling tasks.</p>
                <p>
                    In this section, you can observe each active process in the pool, with the icon changing to the
                    avatar of the task being processed.
                </p>
            </>
        ),
        isFixed: true,
        disableScrolling: true,
        spotlightClicks: true,
    },
    {
        target: "#registered-tasks",
        placement: "top",
        title: "What it can do",
        content: (
            <>
                <p>
                    Listed here are the task types this worker is capable executing. The small badge beside each task
                    shows the number of tasks this type it has executed
                </p>
                <p>To explore those tasks, click on any task with a badge.</p>
            </>
        ),
        isFixed: true,
        spotlightClicks: true,
        hideFooter: true,
    },
    {
        target: "body",
        placement: "center",
        title: "Welcome to the Explorer!",
        content: "Here you can search for tasks and compare them.",
        isFixed: true,
        disableBeacon: true,
        hideBackButton: true,
    },
    {
        target: "#facets-menu",
        placement: "right-start",
        title: "Filter what you need",
        content: (
            <>
                <p>
                    Facets hold all the unique values associated with each task property, as well as a count of tasks
                    containing that particular value.
                </p>
                <p>
                    By selecting these values, you can refine your search for specific attributes, and the table will
                    present only tasks that match the selected value.
                </p>
            </>
        ),
        isFixed: true,
        spotlightClicks: true,
    },
    {
        target: "body",
        placement: "center",
        title: "Begin Your Exploration!",
        content: "You're all set! Thank you for choosing Celery Insights, and wish you a delightful adventure.",
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
