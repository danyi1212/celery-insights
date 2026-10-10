import { EXECUTION_OBSERVATION_MAX_AGE_MS, getTaskExecution, isExecutionObservationCurrent } from "./task-execution"

const now = Date.parse("2026-10-06T12:00:00Z")
const observation = {
  execution_active: true,
  execution_observed_at: new Date(now - 10_000),
  last_updated: new Date(now - 60_000),
}

describe("getTaskExecution", () => {
  it("distinguishes a positive inspection from a successful empty inspection", () => {
    expect(getTaskExecution(observation, now)).toBe("active")
    expect(getTaskExecution({ ...observation, execution_active: false }, now)).toBe("not_active")
  })

  it.each([true, false])("expires both positive and negative observations", (execution_active) => {
    expect(getTaskExecution({ ...observation, execution_active }, now + EXECUTION_OBSERVATION_MAX_AGE_MS)).toBe(
      "unknown",
    )
  })

  it("accepts an observation newer than a stale tick or a trailing clock", () => {
    expect(getTaskExecution({ ...observation, execution_observed_at: new Date(now + 3_000) }, now)).toBe("active")
    expect(isExecutionObservationCurrent(new Date(now + EXECUTION_OBSERVATION_MAX_AGE_MS), now)).toBe(true)
  })

  it("rejects missing, malformed, far-future, or previous-attempt evidence", () => {
    expect(getTaskExecution({}, now)).toBe("unknown")
    expect(getTaskExecution({ ...observation, execution_observed_at: "invalid" }, now)).toBe("unknown")
    expect(
      getTaskExecution(
        { ...observation, execution_observed_at: new Date(now + EXECUTION_OBSERVATION_MAX_AGE_MS + 1) },
        now,
      ),
    ).toBe("unknown")
    expect(getTaskExecution({ ...observation, last_updated: new Date(now) }, now)).toBe("unknown")
    expect(getTaskExecution({ ...observation, execution_active: null }, now)).toBe("unknown")
  })
})
