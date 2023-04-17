import { create } from "zustand"

interface TourStore {
    run: boolean
    stepIndex: number
}

export const useTourStore = create<TourStore>(() => ({
    run: false,
    stepIndex: 0,
}))

export const startTour = () => useTourStore.setState({ run: true, stepIndex: 0 })
