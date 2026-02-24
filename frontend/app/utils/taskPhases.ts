import { TaskState } from "@services/server"
import { StateTask } from "@utils/translateServerModels"

export interface TaskPhase {
    label: string
    color: string
    startMs: number
    endMs: number
    durationMs: number
}

const TERMINAL_STATES = new Set<TaskState>([
    TaskState.SUCCESS,
    TaskState.FAILURE,
    TaskState.REVOKED,
    TaskState.REJECTED,
    TaskState.RETRY,
    TaskState.IGNORED,
])

export const isTerminalState = (state: TaskState): boolean => TERMINAL_STATES.has(state)

const getFinishedAt = (task: StateTask): Date | undefined =>
    task.succeededAt || task.failedAt || task.retriedAt || task.rejectedAt || task.revokedAt

const getStartedAt = (task: StateTask): Date | undefined => task.startedAt || task.revokedAt || task.rejectedAt

const getReceivedAt = (task: StateTask): Date | undefined => task.receivedAt || task.revokedAt

export const getTaskEndTime = (task: StateTask, now: Date): Date => getFinishedAt(task) || now

export const PHASE_COLORS = {
    queue: "#8b8b8b",
    worker: "#4da6ff",
    running: "#4ade80",
} as const

export const computeTaskPhases = (task: StateTask, now: Date): TaskPhase[] => {
    const phases: TaskPhase[] = []
    const sentMs = task.sentAt.getTime()
    const receivedMs = (getReceivedAt(task) || now).getTime()
    const startedMs = (getStartedAt(task) || now).getTime()
    const finishedMs = getTaskEndTime(task, now).getTime()

    // Queue phase: sentAt -> receivedAt
    if (receivedMs > sentMs) {
        phases.push({
            label: "Waiting in Queue",
            color: PHASE_COLORS.queue,
            startMs: sentMs,
            endMs: receivedMs,
            durationMs: receivedMs - sentMs,
        })
    }

    // Worker phase: receivedAt -> startedAt
    if (getReceivedAt(task) && startedMs > receivedMs) {
        phases.push({
            label: "Waiting in Worker",
            color: PHASE_COLORS.worker,
            startMs: receivedMs,
            endMs: startedMs,
            durationMs: startedMs - receivedMs,
        })
    }

    // Running phase: startedAt -> finishedAt
    if (getStartedAt(task) && finishedMs > startedMs) {
        phases.push({
            label: "Running",
            color: PHASE_COLORS.running,
            startMs: startedMs,
            endMs: finishedMs,
            durationMs: finishedMs - startedMs,
        })
    }

    // If no phases (e.g. only sentAt exists with no further progress), show queue phase to now
    if (phases.length === 0) {
        const nowMs = now.getTime()
        if (nowMs > sentMs) {
            phases.push({
                label: "Waiting in Queue",
                color: PHASE_COLORS.queue,
                startMs: sentMs,
                endMs: nowMs,
                durationMs: nowMs - sentMs,
            })
        }
    }

    return phases
}

export const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`
    const seconds = ms / 1000
    if (seconds < 60) return `${seconds.toFixed(1)}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`
}

export const formatTime = (date: Date, detailed = false): string => {
    const h = date.getHours().toString().padStart(2, "0")
    const m = date.getMinutes().toString().padStart(2, "0")
    const s = date.getSeconds().toString().padStart(2, "0")
    if (detailed) {
        const ms = date.getMilliseconds().toString().padStart(3, "0")
        return `${h}:${m}:${s}.${ms}`
    }
    return `${h}:${m}:${s}`
}
