import { ACTIONS, EVENTS, STATUS } from "react-joyride"
import useSettingsStore from "@stores/use-settings-store"
import { useTourStore } from "@stores/use-tour-store"
import { handleTourEvent } from "./joyride-tour"

type TourEvent = Parameters<typeof handleTourEvent>[0]
const event = (overrides: Partial<TourEvent> = {}): TourEvent => ({
  type: EVENTS.STEP_AFTER,
  action: ACTIONS.NEXT,
  status: STATUS.RUNNING,
  step: { buttons: ["back", "close", "primary"] },
  ...overrides,
})

beforeEach(() => {
  useTourStore.setState({ run: true, tourActive: true, stepIndex: 3, demoMode: false })
  useSettingsStore.setState({ demo: false })
})

it("advances and goes back with the controlled tour store", () => {
  handleTourEvent(event())
  expect(useTourStore.getState().stepIndex).toBe(4)
  handleTourEvent(event({ action: ACTIONS.PREV }))
  expect(useTourStore.getState().stepIndex).toBe(3)
})

it("keeps route-driven steps waiting for navigation", () => {
  handleTourEvent(event({ step: { buttons: [] } }))
  expect(useTourStore.getState().stepIndex).toBe(3)
  expect(useTourStore.getState().run).toBe(true)
})

it.each<TourEvent>([
  event({ type: EVENTS.ERROR }),
  event({ type: EVENTS.TARGET_NOT_FOUND }),
  event({ action: ACTIONS.CLOSE }),
  event({ action: ACTIONS.RESET }),
  event({ status: STATUS.SKIPPED }),
  event({ status: STATUS.FINISHED }),
])("stops and cleans up tour-owned demo mode on termination: %o", (termination) => {
  useTourStore.setState({ demoMode: true })
  useSettingsStore.setState({ demo: true })
  handleTourEvent(termination)
  expect(useTourStore.getState().run).toBe(false)
  expect(useTourStore.getState().demoMode).toBe(false)
  expect(useSettingsStore.getState().demo).toBe(false)
})

it("preserves independently enabled demo mode when the tour closes", () => {
  useSettingsStore.setState({ demo: true })
  handleTourEvent(event({ action: ACTIONS.CLOSE }))
  expect(useTourStore.getState().run).toBe(false)
  expect(useSettingsStore.getState().demo).toBe(true)
})
