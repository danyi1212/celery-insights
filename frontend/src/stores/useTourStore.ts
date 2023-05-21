import { useEffect } from "react"
import { create } from "zustand"

interface TourStore {
    tourActive: boolean
    run: boolean
    stepIndex: number
    demoMode: boolean
}

export const useTourStore = create<TourStore>(() => ({
    tourActive: true,
    run: false,
    stepIndex: 0,
    demoMode: false,
}))

export const startTour = () => useTourStore.setState({ tourActive: true, run: true, stepIndex: 0 })
export const stopTour = () => useTourStore.setState({ tourActive: false, run: false, demoMode: false })
export const nextStep = () => useTourStore.setState((state) => ({ run: true, stepIndex: state.stepIndex + 1 }))
export const backStep = () => useTourStore.setState((state) => ({ run: true, stepIndex: state.stepIndex - 1 }))
export const setStep = (stepIndex: number) => useTourStore.setState({ run: true, stepIndex })
export const useTourChangeStepOnLoad = (stepIndex: number, condition = true) => {
    const tour = useTourStore()

    useEffect(() => {
        if (condition && tour.run && tour.stepIndex === stepIndex - 1) {
            setStep(stepIndex)
        }
    }, [tour, condition, stepIndex])
}
