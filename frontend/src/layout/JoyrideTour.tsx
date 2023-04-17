import { useTourStore } from "@stores/useTourStore"
import React, { useMemo } from "react"
import Joyride, { ACTIONS, CallBackProps, EVENTS, LIFECYCLE, STATUS, Step } from "react-joyride"

const JoyrideTour: React.FC = () => {
    const state = useTourStore()

    const steps = useMemo(
        (): Step[] => [
            {
                target: "body",
                placement: "center",
                title: "Lets begin!",
                content: "This is my first tour step.",
                disableBeacon: true,
            },
            {
                target: "#recent-tasks",
                placement: "top",
                placementBeacon: "top",
                title: "Step 2",
                content: "This is my second tour step.",
                isFixed: true,
                disableScrolling: true,
            },
        ],
        []
    )

    /* eslint-disable no-console */
    const handleCallback = (data: CallBackProps) => {
        console.groupCollapsed(data.type, data.action, data.status)
        console.log(data)
        console.log(state)

        if (data.type == EVENTS.STEP_AFTER || data.type == EVENTS.TARGET_NOT_FOUND) {
            // Next step
            useTourStore.setState((state) => ({
                stepIndex: data.action === ACTIONS.PREV ? state.stepIndex - 1 : state.stepIndex + 1,
            }))
            console.log(data.action === ACTIONS.PREV ? "Going back one step..." : "Next step...")
        } else if (
            data.lifecycle === LIFECYCLE.COMPLETE ||
            data.status === STATUS.FINISHED ||
            data.status === STATUS.SKIPPED
        ) {
            // Finish tour
            useTourStore.setState({ run: false })
            console.log("Finished tour")
        } else {
            console.log("Done nothing")
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
            showProgress
            showSkipButton
        />
    )
}
export default JoyrideTour
