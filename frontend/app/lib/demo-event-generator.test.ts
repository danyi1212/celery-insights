import { DemoEventGenerator } from "./demo-event-generator"

type MockCall = [string, Record<string, unknown>]

// Mock Surreal db
function createMockDb() {
    return {
        query: vi.fn().mockResolvedValue([]),
    }
}

const calls = (db: ReturnType<typeof createMockDb>) => db.query.mock.calls as MockCall[]

describe("DemoEventGenerator", () => {
    let mockDb: ReturnType<typeof createMockDb>
    let generator: DemoEventGenerator

    beforeEach(() => {
        vi.useFakeTimers()
        mockDb = createMockDb()
        generator = new DemoEventGenerator(mockDb as never)
    })

    afterEach(() => {
        generator.stop()
        vi.useRealTimers()
    })

    it("seeds workers on start", async () => {
        await generator.start()

        // Should have UPSERT queries for 3 workers
        const workerUpserts = calls(mockDb).filter(
            ([q]: MockCall) =>
                typeof q === "string" && q.includes("UPSERT type::record('worker'") && q.includes("status = 'online'"),
        )
        expect(workerUpserts.length).toBe(3)

        // Check worker hostnames
        const workerIds = workerUpserts.map(([, params]: MockCall) => params.id)
        expect(workerIds).toContain("celery@worker-1")
        expect(workerIds).toContain("celery@worker-2")
        expect(workerIds).toContain("celery@worker-3")
    })

    it("seeds historical tasks on start", async () => {
        await generator.start()

        // Should have UPSERT queries for task records (from seeded tasks)
        const taskUpserts = calls(mockDb).filter(
            ([q]: MockCall) => typeof q === "string" && q.includes("UPSERT type::record('task'"),
        )
        // 25 individual tasks + 2 workflows + 3 in-progress tasks = lots of task events
        // Each task lifecycle generates multiple events (sent, received, started, succeeded/failed)
        expect(taskUpserts.length).toBeGreaterThan(50)
    })

    it("creates raw events for each task event", async () => {
        await generator.start()

        const eventCreates = calls(mockDb).filter(
            ([q]: MockCall) => typeof q === "string" && q.startsWith("CREATE event SET"),
        )
        // Should have raw events matching task upserts
        expect(eventCreates.length).toBeGreaterThan(50)
    })

    it("generates tasks with valid states", async () => {
        await generator.start()

        const taskUpserts = calls(mockDb).filter(
            ([q]: MockCall) => typeof q === "string" && q.includes("UPSERT type::record('task'"),
        )

        const validStates = ["PENDING", "RECEIVED", "STARTED", "SUCCESS", "FAILURE", "RETRY"]
        for (const [, params] of taskUpserts) {
            if (params?.state) {
                expect(validStates).toContain(params.state)
            }
        }
    })

    it("generates workflow tasks with parent-child relationships", async () => {
        await generator.start()

        // Check for children array updates (workflow parents)
        const childrenUpdates = calls(mockDb).filter(
            ([q]: MockCall) => typeof q === "string" && q.includes("array::union(children"),
        )
        // 2 seeded workflows, each with 2-3 children
        expect(childrenUpdates.length).toBeGreaterThanOrEqual(4)
    })

    it("generates worker heartbeats periodically", async () => {
        await generator.start()

        // Clear the seeding queries
        mockDb.query.mockClear()

        // Advance 5 seconds for heartbeat
        await vi.advanceTimersByTimeAsync(5000)

        const heartbeats = calls(mockDb).filter(
            ([q]: MockCall) =>
                typeof q === "string" && q.includes("UPDATE type::record('worker'") && q.includes("missed_polls = 0"),
        )
        expect(heartbeats.length).toBe(3) // 3 workers
    })

    it("generates continuous tasks over time", async () => {
        await generator.start()

        // Clear seeding queries
        mockDb.query.mockClear()

        // Advance enough time for continuous generation (tasks every 2-5s)
        await vi.advanceTimersByTimeAsync(10_000)

        // Should have generated at least 1-2 new tasks (2-5s intervals)
        const newTaskUpserts = calls(mockDb).filter(
            ([q]: MockCall) => typeof q === "string" && q.includes("UPSERT type::record('task'"),
        )
        expect(newTaskUpserts.length).toBeGreaterThan(0)
    })

    it("stops all generation when stop is called", async () => {
        await generator.start()
        mockDb.query.mockClear()

        generator.stop()

        // Advance time — should not generate anything
        await vi.advanceTimersByTimeAsync(30_000)

        // No new queries after stop (only heartbeats might have been mid-flight)
        expect(calls(mockDb).length).toBe(0)
    })

    it("handles db errors gracefully during seeding", async () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
        mockDb.query.mockRejectedValue(new Error("DB error"))

        // Should not throw
        await generator.start()

        consoleSpy.mockRestore()
    })

    it("handles db errors gracefully during continuous generation", async () => {
        await generator.start()

        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
        mockDb.query.mockRejectedValue(new Error("DB error"))

        // Advance time — should not throw
        await vi.advanceTimersByTimeAsync(10_000)

        consoleSpy.mockRestore()
    })

    it("generates tasks with metadata (args, kwargs, task type)", async () => {
        await generator.start()

        // Find task-sent events (they carry task metadata)
        const sentEvents = calls(mockDb).filter(
            ([q, params]: MockCall) =>
                typeof q === "string" && q.includes("UPSERT type::record('task'") && params?.taskType,
        )
        expect(sentEvents.length).toBeGreaterThan(0)

        // Check that task metadata is present
        for (const [, params] of sentEvents) {
            expect(params.taskType).toBeTruthy()
            expect(params.args).toBeTruthy()
            expect(params.kwargs).toBeTruthy()
        }
    })

    it("generates failed tasks with exception and traceback", async () => {
        await generator.start()

        // Find failed task events
        const failedEvents = calls(mockDb).filter(
            ([q, params]: MockCall) =>
                typeof q === "string" && q.includes("UPSERT type::record('task'") && params?.exception,
        )
        // With ~30 tasks and 12% failure rate + 6% retry rate, we should have some failures
        expect(failedEvents.length).toBeGreaterThan(0)

        for (const [, params] of failedEvents) {
            expect(params.exception).toBeTruthy()
            expect(params.traceback).toBeTruthy()
        }
    })

    it("sets worker inspect data with stats and registered tasks", async () => {
        await generator.start()

        const workerUpserts = calls(mockDb).filter(
            ([q]: MockCall) =>
                typeof q === "string" && q.includes("UPSERT type::record('worker'") && q.includes("inspect"),
        )

        expect(workerUpserts.length).toBe(3)

        for (const [, params] of workerUpserts) {
            const inspect = JSON.parse(params.inspect as string)
            expect(inspect.stats).toBeDefined()
            expect(inspect.registered).toBeDefined()
            expect(inspect.active_queues).toBeDefined()
        }
    })
})
