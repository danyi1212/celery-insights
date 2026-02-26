import { TaskState } from "@/types/surreal-records"
import { createStateTask } from "@test-fixtures"
import {
    isTerminalState,
    getTaskEndTime,
    computeTaskPhases,
    formatDuration,
    formatTime,
    PHASE_COLORS,
} from "./task-phases"

describe("isTerminalState", () => {
    it.each([
        TaskState.SUCCESS,
        TaskState.FAILURE,
        TaskState.REVOKED,
        TaskState.REJECTED,
        TaskState.RETRY,
        TaskState.IGNORED,
    ])("returns true for terminal state %s", (state) => {
        expect(isTerminalState(state)).toBe(true)
    })

    it.each([TaskState.PENDING, TaskState.RECEIVED, TaskState.STARTED])(
        "returns false for non-terminal state %s",
        (state) => {
            expect(isTerminalState(state)).toBe(false)
        },
    )
})

describe("getTaskEndTime", () => {
    const now = new Date("2024-01-01T12:00:00Z")

    it("returns succeededAt when task succeeded", () => {
        const task = createStateTask({ succeededAt: new Date("2024-01-01T11:00:00Z") })
        expect(getTaskEndTime(task, now)).toEqual(new Date("2024-01-01T11:00:00Z"))
    })

    it("returns failedAt when task failed", () => {
        const task = createStateTask({ succeededAt: undefined, failedAt: new Date("2024-01-01T11:30:00Z") })
        expect(getTaskEndTime(task, now)).toEqual(new Date("2024-01-01T11:30:00Z"))
    })

    it("returns retriedAt when task retried", () => {
        const task = createStateTask({
            succeededAt: undefined,
            failedAt: undefined,
            retriedAt: new Date("2024-01-01T11:15:00Z"),
        })
        expect(getTaskEndTime(task, now)).toEqual(new Date("2024-01-01T11:15:00Z"))
    })

    it("prioritizes succeededAt over other finish timestamps", () => {
        const task = createStateTask({
            succeededAt: new Date("2024-01-01T11:00:00Z"),
            failedAt: new Date("2024-01-01T11:30:00Z"),
        })
        expect(getTaskEndTime(task, now)).toEqual(new Date("2024-01-01T11:00:00Z"))
    })

    it("returns rejectedAt when only rejectedAt is set", () => {
        const task = createStateTask({
            succeededAt: undefined,
            failedAt: undefined,
            retriedAt: undefined,
            rejectedAt: new Date("2024-01-01T11:20:00Z"),
            revokedAt: undefined,
        })
        expect(getTaskEndTime(task, now)).toEqual(new Date("2024-01-01T11:20:00Z"))
    })

    it("returns revokedAt when only revokedAt is set", () => {
        const task = createStateTask({
            succeededAt: undefined,
            failedAt: undefined,
            retriedAt: undefined,
            rejectedAt: undefined,
            revokedAt: new Date("2024-01-01T11:25:00Z"),
        })
        expect(getTaskEndTime(task, now)).toEqual(new Date("2024-01-01T11:25:00Z"))
    })

    it("falls back to now when no terminal timestamp exists", () => {
        const task = createStateTask({
            succeededAt: undefined,
            failedAt: undefined,
            retriedAt: undefined,
            rejectedAt: undefined,
            revokedAt: undefined,
        })
        expect(getTaskEndTime(task, now)).toEqual(now)
    })
})

describe("computeTaskPhases", () => {
    const now = new Date("2024-01-01T12:00:00Z")

    it("computes 3 phases for a full lifecycle task", () => {
        const sentAt = new Date("2024-01-01T11:00:00Z")
        const receivedAt = new Date("2024-01-01T11:00:01Z")
        const startedAt = new Date("2024-01-01T11:00:02Z")
        const succeededAt = new Date("2024-01-01T11:00:05Z")

        const task = createStateTask({ sentAt, receivedAt, startedAt, succeededAt })
        const phases = computeTaskPhases(task, now)

        expect(phases).toHaveLength(3)
        expect(phases[0].label).toBe("Waiting in Queue")
        expect(phases[0].color).toBe(PHASE_COLORS.queue)
        expect(phases[0].durationMs).toBe(1000)
        expect(phases[1].label).toBe("Waiting in Worker")
        expect(phases[1].color).toBe(PHASE_COLORS.worker)
        expect(phases[1].durationMs).toBe(1000)
        expect(phases[2].label).toBe("Running")
        expect(phases[2].color).toBe(PHASE_COLORS.running)
        expect(phases[2].durationMs).toBe(3000)
    })

    it("computes single queue phase for a task with only sentAt", () => {
        const sentAt = new Date("2024-01-01T11:59:50Z")
        const task = createStateTask({
            sentAt,
            receivedAt: undefined,
            startedAt: undefined,
            succeededAt: undefined,
            state: TaskState.PENDING,
        })
        const phases = computeTaskPhases(task, now)

        expect(phases).toHaveLength(1)
        expect(phases[0].label).toBe("Waiting in Queue")
        expect(phases[0].durationMs).toBe(10000)
    })

    it("handles zero-duration phases by omitting them", () => {
        const t = new Date("2024-01-01T11:00:00Z")
        const task = createStateTask({
            sentAt: t,
            receivedAt: t,
            startedAt: t,
            succeededAt: new Date("2024-01-01T11:00:05Z"),
        })
        const phases = computeTaskPhases(task, now)

        // Only running phase since queue and worker durations are 0
        expect(phases).toHaveLength(1)
        expect(phases[0].label).toBe("Running")
    })

    it("shows running task phases extending to now", () => {
        const sentAt = new Date("2024-01-01T11:59:55Z")
        const receivedAt = new Date("2024-01-01T11:59:56Z")
        const startedAt = new Date("2024-01-01T11:59:57Z")

        const task = createStateTask({
            sentAt,
            receivedAt,
            startedAt,
            succeededAt: undefined,
            state: TaskState.STARTED,
        })
        const phases = computeTaskPhases(task, now)

        expect(phases).toHaveLength(3)
        expect(phases[2].label).toBe("Running")
        expect(phases[2].endMs).toBe(now.getTime())
    })

    it("skips worker wait phase when task was not received", () => {
        const sentAt = new Date("2024-01-01T11:00:00Z")
        const task = createStateTask({
            sentAt,
            receivedAt: undefined,
            startedAt: undefined,
            succeededAt: undefined,
            revokedAt: new Date("2024-01-01T11:00:05Z"),
            state: TaskState.REVOKED,
        })
        const phases = computeTaskPhases(task, now)

        // Queue phase (sent -> revoked used as received fallback) and Running phase (revoked as start -> revoked as finish)
        // But since start == finish for running, it's omitted. So queue + possibly running.
        const labels = phases.map((p) => p.label)
        expect(labels).toContain("Waiting in Queue")
        expect(labels).not.toContain("Waiting in Worker")
    })

    it("handles revoked task with revokedAt as fallback", () => {
        const sentAt = new Date("2024-01-01T11:00:00Z")
        const revokedAt = new Date("2024-01-01T11:00:03Z")

        const task = createStateTask({
            sentAt,
            receivedAt: undefined,
            startedAt: undefined,
            succeededAt: undefined,
            revokedAt,
            state: TaskState.REVOKED,
        })
        const phases = computeTaskPhases(task, now)

        expect(phases.length).toBeGreaterThanOrEqual(1)
        expect(phases[0].label).toBe("Waiting in Queue")
    })
})

describe("formatDuration", () => {
    it("formats milliseconds for values under 1 second", () => {
        expect(formatDuration(500)).toBe("500ms")
        expect(formatDuration(1)).toBe("1ms")
    })

    it("formats 0ms", () => {
        expect(formatDuration(0)).toBe("0ms")
    })

    it("formats seconds for values under 60 seconds", () => {
        expect(formatDuration(1000)).toBe("1.0s")
        expect(formatDuration(1500)).toBe("1.5s")
        expect(formatDuration(59949)).toBe("59.9s")
        expect(formatDuration(59999)).toBe("1m 0s")
    })

    it("formats minutes for values >= 60 seconds", () => {
        expect(formatDuration(60000)).toBe("1m 0s")
        expect(formatDuration(90000)).toBe("1m 30s")
        expect(formatDuration(125000)).toBe("2m 5s")
    })

    it("handles boundary at 1 second", () => {
        expect(formatDuration(999)).toBe("999ms")
        expect(formatDuration(1000)).toBe("1.0s")
    })
})

describe("formatTime", () => {
    it("formats time as HH:MM:SS by default", () => {
        const date = new Date("2024-01-01T09:05:03.000Z")
        const result = formatTime(date)
        // The exact output depends on timezone, but format should be HH:MM:SS
        expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    })

    it("formats detailed time with milliseconds", () => {
        const date = new Date("2024-01-01T09:05:03.007Z")
        const result = formatTime(date, true)
        expect(result).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/)
    })

    it("zero-pads hours, minutes, and seconds", () => {
        // Use a date where we know the local components
        const date = new Date(2024, 0, 1, 1, 2, 3)
        expect(formatTime(date)).toBe("01:02:03")
    })

    it("zero-pads milliseconds in detailed mode", () => {
        const date = new Date(2024, 0, 1, 1, 2, 3, 7)
        expect(formatTime(date, true)).toBe("01:02:03.007")
    })
})
