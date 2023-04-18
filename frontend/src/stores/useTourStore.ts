import { create } from "zustand"

interface TourStore {
    tourActive: boolean
    run: boolean
    stepIndex: number
}

export const useTourStore = create<TourStore>(() => ({
    tourActive: true,
    run: false,
    stepIndex: 0,
}))

export const startTour = () => useTourStore.setState({ tourActive: true, run: true, stepIndex: 0 })
export const stopTour = () => useTourStore.setState({ tourActive: false, run: false })
export const nextStep = () => useTourStore.setState((state) => ({ run: true, stepIndex: state.stepIndex + 1 }))
export const backStep = () => useTourStore.setState((state) => ({ run: true, stepIndex: state.stepIndex - 1 }))
export const setStep = (stepIndex: number) => useTourStore.setState({ run: true, stepIndex })
