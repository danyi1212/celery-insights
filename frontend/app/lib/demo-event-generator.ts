/**
 * Demo event generator — creates realistic Celery events and inserts them
 * into the embedded SurrealDB instance so live query hooks work identically
 * to production mode.
 *
 * Simulates:
 * - Multiple workers coming online with heartbeats
 * - Tasks flowing through their lifecycle (PENDING → RECEIVED → STARTED → SUCCESS/FAILURE)
 * - Workflows with parent/child task relationships
 * - Retries and various failure modes
 * - Realistic timing and intervals
 */
import type { Surreal } from "surrealdb"

// --- Configuration ---

const DEMO_WORKERS = ["celery@worker-1", "celery@worker-2", "celery@worker-3"] as const

const TASK_TYPES = [
    "myapp.tasks.process_order",
    "myapp.tasks.send_email",
    "myapp.tasks.generate_report",
    "myapp.tasks.sync_inventory",
    "myapp.tasks.resize_image",
    "myapp.tasks.calculate_metrics",
    "myapp.tasks.import_data",
    "myapp.tasks.notify_user",
    "myapp.tasks.cleanup_old_files",
    "myapp.tasks.update_search_index",
] as const

/** Workflows: a root task type followed by the child task types it spawns */
const WORKFLOWS: { root: string; children: string[] }[] = [
    {
        root: "myapp.tasks.process_order",
        children: ["myapp.tasks.send_email", "myapp.tasks.sync_inventory", "myapp.tasks.notify_user"],
    },
    {
        root: "myapp.tasks.generate_report",
        children: ["myapp.tasks.calculate_metrics", "myapp.tasks.send_email"],
    },
    {
        root: "myapp.tasks.import_data",
        children: ["myapp.tasks.update_search_index", "myapp.tasks.notify_user"],
    },
]

const EXCEPTIONS = [
    {
        exception: "ValueError('Invalid input data')",
        traceback:
            'Traceback (most recent call last):\n  File "/app/tasks.py", line 42, in process_order\n    validate(data)\nValueError: Invalid input data',
    },
    {
        exception: "ConnectionError('Database connection refused')",
        traceback:
            'Traceback (most recent call last):\n  File "/app/tasks.py", line 18, in sync_inventory\n    db.connect()\nConnectionError: Database connection refused',
    },
    {
        exception: "TimeoutError('Request timed out after 30s')",
        traceback:
            'Traceback (most recent call last):\n  File "/app/tasks.py", line 55, in send_email\n    smtp.send(msg)\nTimeoutError: Request timed out after 30s',
    },
    {
        exception: "KeyError('missing_field')",
        traceback:
            "Traceback (most recent call last):\n  File \"/app/tasks.py\", line 73, in calculate_metrics\n    value = data['missing_field']\nKeyError: 'missing_field'",
    },
]

const SAMPLE_ARGS = [
    '("order_123", "user_456")',
    '("report_2024_q4",)',
    '("user@example.com", "Welcome!")',
    '("inventory_batch_99",)',
    '("/uploads/photo.jpg", 800, 600)',
    '("2024-01-01", "2024-12-31")',
    '("export_file.csv",)',
    '("user_789", "Order shipped")',
    '("/tmp/old_cache",)',
    '("products",)',
]

const SAMPLE_KWARGS = [
    "{}",
    '{"priority": "high"}',
    '{"format": "pdf", "pages": 50}',
    '{"retry": true, "timeout": 30}',
    '{"quality": 85}',
]

const SAMPLE_RESULTS = [
    '"Order processed successfully"',
    '{"status": "sent", "message_id": "msg_abc123"}',
    '{"rows": 1542, "duration_ms": 234}',
    '"Inventory synced: 42 items updated"',
    '{"width": 800, "height": 600, "size_kb": 124}',
    '{"avg": 42.5, "median": 38.0, "p99": 120.3}',
    '"Imported 1000 records"',
    '"Notification sent to user_789"',
    '"Cleaned up 15 files (2.3 MB freed)"',
    '"Index updated: 500 documents"',
]

// --- Utilities ---

let _idCounter = 0

function generateTaskId(): string {
    _idCounter++
    const hex = (n: number) => n.toString(16).padStart(4, "0")
    const r = () => Math.floor(Math.random() * 0xffff)
    return `${hex(r())}-${hex(_idCounter)}-${hex(r())}-${hex(r())}-${hex(r())}${hex(r())}${hex(r())}`
}

function randomChoice<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
}

function randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min)
}

// --- Event insertion ---

interface TaskLifecycleEvent {
    taskId: string
    taskType: string
    worker: string
    rootId?: string
    parentId?: string
    args: string
    kwargs: string
}

async function insertWorkerOnline(db: Surreal, hostname: string, ts: Date): Promise<void> {
    const iso = ts.toISOString()
    await db.query(
        `UPSERT type::record('worker', $id) SET
            status = 'online',
            last_updated = <datetime>$ts,
            missed_polls = 0,
            hostname = $hostname,
            inspect = $inspect`,
        {
            id: hostname,
            ts: iso,
            hostname,
            inspect: JSON.stringify({
                stats: {
                    pool: { "max-concurrency": 4, processes: [1001, 1002, 1003, 1004] },
                    broker: { transport: "amqp", hostname: "rabbitmq", port: 5672 },
                    prefetch_count: 16,
                    rusage: { stime: 1.2, utime: 3.4, maxrss: 65536 },
                    total: {},
                },
                registered: TASK_TYPES.slice(0, 6),
                active_queues: [
                    { name: "celery", exchange: { name: "celery", type: "direct" }, routing_key: "celery" },
                ],
            }),
        },
    )
}

async function insertWorkerHeartbeat(db: Surreal, hostname: string, ts: Date): Promise<void> {
    const iso = ts.toISOString()
    await db.query(
        `UPDATE type::record('worker', $id) SET
            last_updated = <datetime>$ts,
            missed_polls = 0`,
        { id: hostname, ts: iso },
    )
}

async function insertTaskEvent(
    db: Surreal,
    eventType: string,
    task: TaskLifecycleEvent,
    ts: Date,
    extra?: Record<string, unknown>,
): Promise<void> {
    const iso = ts.toISOString()

    // Build raw event
    const rawData: Record<string, unknown> = {
        type: eventType,
        uuid: task.taskId,
        timestamp: ts.getTime() / 1000,
        hostname: task.worker,
        ...extra,
    }

    await db.query(
        `CREATE event SET
            event_type = $eventType,
            task_id = $taskId,
            timestamp = <datetime>$ts,
            hostname = $worker,
            data = $data`,
        {
            eventType,
            taskId: task.taskId,
            ts: iso,
            worker: task.worker,
            data: JSON.stringify(rawData),
        },
    )

    // Determine state and timestamp field
    const stateMap: Record<string, string> = {
        "task-sent": "PENDING",
        "task-received": "RECEIVED",
        "task-started": "STARTED",
        "task-succeeded": "SUCCESS",
        "task-failed": "FAILURE",
        "task-rejected": "REJECTED",
        "task-revoked": "REVOKED",
        "task-retried": "RETRY",
    }
    const tsFieldMap: Record<string, string> = {
        "task-sent": "sent_at",
        "task-received": "received_at",
        "task-started": "started_at",
        "task-succeeded": "succeeded_at",
        "task-failed": "failed_at",
        "task-rejected": "rejected_at",
        "task-revoked": "revoked_at",
        "task-retried": "retried_at",
    }

    const state = stateMap[eventType]
    const tsField = tsFieldMap[eventType]
    if (!state || !tsField) return

    // Build SET clauses
    const setClauses = [
        `state = IF last_updated IS NONE OR <datetime>$ts > last_updated THEN $state ELSE state END`,
        `last_updated = IF last_updated IS NONE OR <datetime>$ts > last_updated THEN <datetime>$ts ELSE last_updated END`,
        `${tsField} = IF ${tsField} IS NONE OR <datetime>$ts < ${tsField} THEN <datetime>$ts ELSE ${tsField} END`,
        `worker = IF last_updated IS NONE OR <datetime>$ts >= last_updated THEN $worker ELSE worker END`,
    ]

    const params: Record<string, unknown> = {
        id: task.taskId,
        ts: iso,
        state,
        worker: task.worker,
    }

    // Include task metadata on sent/received events
    if (eventType === "task-sent" || eventType === "task-received") {
        setClauses.push(`type = IF last_updated IS NONE OR <datetime>$ts >= last_updated THEN $taskType ELSE type END`)
        setClauses.push(`args = IF last_updated IS NONE OR <datetime>$ts >= last_updated THEN $args ELSE args END`)
        setClauses.push(
            `kwargs = IF last_updated IS NONE OR <datetime>$ts >= last_updated THEN $kwargs ELSE kwargs END`,
        )
        params.taskType = task.taskType
        params.args = task.args
        params.kwargs = task.kwargs

        if (task.rootId) {
            setClauses.push(
                `root_id = IF last_updated IS NONE OR <datetime>$ts >= last_updated THEN $rootId ELSE root_id END`,
            )
            params.rootId = task.rootId
        }
        if (task.parentId) {
            setClauses.push(
                `parent_id = IF last_updated IS NONE OR <datetime>$ts >= last_updated THEN $parentId ELSE parent_id END`,
            )
            params.parentId = task.parentId
        }
    }

    // Include result/exception on terminal events
    if (extra?.result !== undefined) {
        setClauses.push(
            `result = IF last_updated IS NONE OR <datetime>$ts >= last_updated THEN $result ELSE result END`,
        )
        params.result = String(extra.result)
    }
    if (extra?.runtime !== undefined) {
        setClauses.push(
            `runtime = IF last_updated IS NONE OR <datetime>$ts >= last_updated THEN $runtime ELSE runtime END`,
        )
        params.runtime = extra.runtime
    }
    if (extra?.exception !== undefined) {
        setClauses.push(
            `exception = IF last_updated IS NONE OR <datetime>$ts >= last_updated THEN $exception ELSE exception END`,
        )
        params.exception = String(extra.exception)
    }
    if (extra?.traceback !== undefined) {
        setClauses.push(
            `traceback = IF last_updated IS NONE OR <datetime>$ts >= last_updated THEN $traceback ELSE traceback END`,
        )
        params.traceback = String(extra.traceback)
    }
    if (extra?.retries !== undefined) {
        setClauses.push(
            `retries = IF last_updated IS NONE OR <datetime>$ts >= last_updated THEN $retries ELSE retries END`,
        )
        params.retries = extra.retries
    }

    const query = `UPSERT type::record('task', $id) SET ${setClauses.join(", ")}`
    await db.query(query, params)

    // Update parent's children array if this is a child task
    if (task.parentId && (eventType === "task-sent" || eventType === "task-received")) {
        await db.query(
            `UPDATE type::record('task', $parentId) SET children = array::union(children ?? [], [$childId])`,
            { parentId: task.parentId, childId: task.taskId },
        )
    }
}

// --- Task lifecycle simulation ---

async function simulateTaskLifecycle(
    db: Surreal,
    task: TaskLifecycleEvent,
    baseTime: Date,
    options?: { fail?: boolean; retry?: boolean },
): Promise<void> {
    // PENDING (task-sent)
    const sentTime = new Date(baseTime.getTime())
    await insertTaskEvent(db, "task-sent", task, sentTime, {
        name: task.taskType,
        args: task.args,
        kwargs: task.kwargs,
        retries: 0,
        root_id: task.rootId,
        parent_id: task.parentId,
    })

    // RECEIVED (task-received) — small delay
    const receivedTime = new Date(sentTime.getTime() + randomBetween(50, 300))
    await insertTaskEvent(db, "task-received", task, receivedTime)

    // STARTED (task-started) — medium delay
    const startedTime = new Date(receivedTime.getTime() + randomBetween(100, 2000))
    await insertTaskEvent(db, "task-started", task, startedTime)

    if (options?.retry) {
        // RETRY — simulate a retry then succeed
        const retryTime = new Date(startedTime.getTime() + randomBetween(500, 3000))
        const retryError = randomChoice(EXCEPTIONS)
        await insertTaskEvent(db, "task-retried", task, retryTime, {
            exception: retryError.exception,
            traceback: retryError.traceback,
            retries: 1,
        })

        // Re-start after retry
        const restartTime = new Date(retryTime.getTime() + randomBetween(1000, 5000))
        await insertTaskEvent(db, "task-started", task, restartTime)

        // Then succeed
        const runtime = randomBetween(0.5, 8.0)
        const succeededTime = new Date(restartTime.getTime() + runtime * 1000)
        await insertTaskEvent(db, "task-succeeded", task, succeededTime, {
            result: randomChoice(SAMPLE_RESULTS),
            runtime: Math.round(runtime * 1000) / 1000,
        })
    } else if (options?.fail) {
        // FAILURE
        const runtime = randomBetween(0.2, 5.0)
        const failedTime = new Date(startedTime.getTime() + runtime * 1000)
        const error = randomChoice(EXCEPTIONS)
        await insertTaskEvent(db, "task-failed", task, failedTime, {
            exception: error.exception,
            traceback: error.traceback,
            runtime: Math.round(runtime * 1000) / 1000,
        })
    } else {
        // SUCCESS
        const runtime = randomBetween(0.1, 12.0)
        const succeededTime = new Date(startedTime.getTime() + runtime * 1000)
        await insertTaskEvent(db, "task-succeeded", task, succeededTime, {
            result: randomChoice(SAMPLE_RESULTS),
            runtime: Math.round(runtime * 1000) / 1000,
        })
    }
}

async function simulateWorkflow(db: Surreal, baseTime: Date): Promise<void> {
    const workflow = randomChoice(WORKFLOWS)
    const rootId = generateTaskId()
    const rootWorker = randomChoice(DEMO_WORKERS)

    // Root task starts
    const rootTask: TaskLifecycleEvent = {
        taskId: rootId,
        taskType: workflow.root,
        worker: rootWorker,
        rootId,
        args: randomChoice(SAMPLE_ARGS),
        kwargs: randomChoice(SAMPLE_KWARGS),
    }

    await insertTaskEvent(db, "task-sent", rootTask, baseTime, {
        name: workflow.root,
        args: rootTask.args,
        kwargs: rootTask.kwargs,
        retries: 0,
        root_id: rootId,
    })

    const receivedTime = new Date(baseTime.getTime() + randomBetween(50, 200))
    await insertTaskEvent(db, "task-received", rootTask, receivedTime)

    const startedTime = new Date(receivedTime.getTime() + randomBetween(100, 500))
    await insertTaskEvent(db, "task-started", rootTask, startedTime)

    // Spawn children with staggered timing
    let childOffset = randomBetween(500, 2000)
    for (const childType of workflow.children) {
        const childId = generateTaskId()
        const childWorker = randomChoice(DEMO_WORKERS)
        const childTime = new Date(startedTime.getTime() + childOffset)

        const shouldFail = Math.random() < 0.15
        const childTask: TaskLifecycleEvent = {
            taskId: childId,
            taskType: childType,
            worker: childWorker,
            rootId,
            parentId: rootId,
            args: randomChoice(SAMPLE_ARGS),
            kwargs: randomChoice(SAMPLE_KWARGS),
        }

        await simulateTaskLifecycle(db, childTask, childTime, { fail: shouldFail })
        childOffset += randomBetween(200, 1500)
    }

    // Root task completes after children
    const rootRuntime = randomBetween(2.0, 15.0)
    const rootDoneTime = new Date(startedTime.getTime() + childOffset + rootRuntime * 1000)
    const anyChildFailed = Math.random() < 0.1
    if (anyChildFailed) {
        const error = randomChoice(EXCEPTIONS)
        await insertTaskEvent(db, "task-failed", rootTask, rootDoneTime, {
            exception: error.exception,
            traceback: error.traceback,
            runtime: Math.round(rootRuntime * 1000) / 1000,
        })
    } else {
        await insertTaskEvent(db, "task-succeeded", rootTask, rootDoneTime, {
            result: randomChoice(SAMPLE_RESULTS),
            runtime: Math.round(rootRuntime * 1000) / 1000,
        })
    }
}

// --- Main generator class ---

export class DemoEventGenerator {
    private db: Surreal
    private stopped = false
    private intervals: ReturnType<typeof setInterval>[] = []
    private timeouts: ReturnType<typeof setTimeout>[] = []

    constructor(db: Surreal) {
        this.db = db
    }

    /** Start generating demo events. Seeds historical data, then generates continuously. */
    async start(): Promise<void> {
        try {
            await this.seedWorkers()
            await this.seedHistoricalTasks()
            this.startContinuousGeneration()
            this.startWorkerHeartbeats()
        } catch (err) {
            console.error("Demo event generator failed to start:", err)
        }
    }

    /** Stop all event generation. */
    stop(): void {
        this.stopped = true
        for (const id of this.intervals) clearInterval(id)
        for (const id of this.timeouts) clearTimeout(id)
        this.intervals = []
        this.timeouts = []
    }

    private async seedWorkers(): Promise<void> {
        const now = new Date()
        for (const worker of DEMO_WORKERS) {
            if (this.stopped) return
            await insertWorkerOnline(this.db, worker, now)
        }
    }

    private async seedHistoricalTasks(): Promise<void> {
        const now = Date.now()

        // Seed ~25 historical tasks spread over the last 5 minutes
        for (let i = 0; i < 25; i++) {
            if (this.stopped) return
            const offset = randomBetween(5000, 300_000) // 5s to 5min ago
            const baseTime = new Date(now - offset)
            const taskId = generateTaskId()
            const taskType = randomChoice(TASK_TYPES)
            const worker = randomChoice(DEMO_WORKERS)

            const roll = Math.random()
            const fail = roll < 0.12
            const retry = !fail && roll < 0.18

            const task: TaskLifecycleEvent = {
                taskId,
                taskType,
                worker,
                args: randomChoice(SAMPLE_ARGS),
                kwargs: randomChoice(SAMPLE_KWARGS),
            }

            await simulateTaskLifecycle(this.db, task, baseTime, { fail, retry })
        }

        // Seed 2 historical workflows
        for (let i = 0; i < 2; i++) {
            if (this.stopped) return
            const offset = randomBetween(30_000, 180_000) // 30s to 3min ago
            const baseTime = new Date(now - offset)
            await simulateWorkflow(this.db, baseTime)
        }

        // Seed a few in-progress tasks (no terminal event yet)
        for (let i = 0; i < 3; i++) {
            if (this.stopped) return
            const taskId = generateTaskId()
            const taskType = randomChoice(TASK_TYPES)
            const worker = randomChoice(DEMO_WORKERS)
            const baseTime = new Date(now - randomBetween(1000, 10_000))

            const task: TaskLifecycleEvent = {
                taskId,
                taskType,
                worker,
                args: randomChoice(SAMPLE_ARGS),
                kwargs: randomChoice(SAMPLE_KWARGS),
            }

            // Only send + receive + maybe start
            await insertTaskEvent(this.db, "task-sent", task, baseTime, {
                name: taskType,
                args: task.args,
                kwargs: task.kwargs,
                retries: 0,
            })
            const receivedTime = new Date(baseTime.getTime() + randomBetween(50, 200))
            await insertTaskEvent(this.db, "task-received", task, receivedTime)

            if (Math.random() > 0.3) {
                const startedTime = new Date(receivedTime.getTime() + randomBetween(100, 500))
                await insertTaskEvent(this.db, "task-started", task, startedTime)
            }
        }
    }

    private startContinuousGeneration(): void {
        // Generate a new task every 2-5 seconds
        const scheduleNext = () => {
            if (this.stopped) return
            const delay = randomBetween(2000, 5000)
            const timeout = setTimeout(async () => {
                if (this.stopped) return
                try {
                    await this.generateOneTask()
                } catch (err) {
                    console.error("Demo event generator error:", err)
                }
                scheduleNext()
            }, delay)
            this.timeouts.push(timeout)
        }
        scheduleNext()

        // Generate a workflow every 15-30 seconds
        const scheduleWorkflow = () => {
            if (this.stopped) return
            const delay = randomBetween(15_000, 30_000)
            const timeout = setTimeout(async () => {
                if (this.stopped) return
                try {
                    await simulateWorkflow(this.db, new Date())
                } catch (err) {
                    console.error("Demo workflow generator error:", err)
                }
                scheduleWorkflow()
            }, delay)
            this.timeouts.push(timeout)
        }
        scheduleWorkflow()
    }

    private async generateOneTask(): Promise<void> {
        const taskId = generateTaskId()
        const taskType = randomChoice(TASK_TYPES)
        const worker = randomChoice(DEMO_WORKERS)
        const now = new Date()

        const roll = Math.random()
        const fail = roll < 0.12
        const retry = !fail && roll < 0.18

        const task: TaskLifecycleEvent = {
            taskId,
            taskType,
            worker,
            args: randomChoice(SAMPLE_ARGS),
            kwargs: randomChoice(SAMPLE_KWARGS),
        }

        await simulateTaskLifecycle(this.db, task, now, { fail, retry })
    }

    private startWorkerHeartbeats(): void {
        // Send worker heartbeats every 5 seconds
        const interval = setInterval(async () => {
            if (this.stopped) return
            const now = new Date()
            for (const worker of DEMO_WORKERS) {
                try {
                    await insertWorkerHeartbeat(this.db, worker, now)
                } catch {
                    // Ignore heartbeat errors
                }
            }
        }, 5000)
        this.intervals.push(interval)
    }
}
