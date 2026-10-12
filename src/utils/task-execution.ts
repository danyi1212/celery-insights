export interface TaskExecutionObservation {
  execution_active?: boolean | null
  execution_observed_at?: Date | string | null
  last_updated?: Date | string | null
}

export type TaskExecution = "active" | "not_active" | "unknown"

export const EXECUTION_OBSERVATION_MAX_AGE_MS = 120_000

// The expiry window is the only tolerance, applied in both directions: a reader's clock, or a shared
// tick that is up to 10 s stale, may trail the monitor that stamped the observation.
export const isExecutionObservationCurrent = (timestamp: Date | string | null | undefined, now: number): boolean => {
  const observedAt = timestamp ? new Date(timestamp).getTime() : NaN
  return Number.isFinite(observedAt) && Math.abs(now - observedAt) <= EXECUTION_OBSERVATION_MAX_AGE_MS
}

export const getTaskExecution = (task: TaskExecutionObservation, now: number): TaskExecution => {
  const observedAt = task.execution_observed_at ? new Date(task.execution_observed_at).getTime() : NaN
  const updatedAt = task.last_updated ? new Date(task.last_updated).getTime() : NaN
  if (!isExecutionObservationCurrent(task.execution_observed_at, now) || observedAt < updatedAt) {
    return "unknown"
  }
  if (task.execution_active === true) return "active"
  if (task.execution_active === false) return "not_active"
  return "unknown"
}

export const TASK_EXECUTION_LABELS: Record<TaskExecution, string> = {
  active: "Observed running",
  not_active: "Not observed running",
  unknown: "Execution unconfirmed",
}
