import { EventType, Task, TaskState, EventCategory } from "@services/server"
import { handleEvent } from "@stores/useStateStore"
import { CancellationToken } from "@utils/simulator/cancellationToken"
import { getRandomException } from "@utils/simulator/exceptionSimulator"
import { v4 as uuidv4 } from "uuid"

class CancelError extends Error {}

const delay = (ms: number, cancellationToken: CancellationToken) =>
    new Promise((resolve, reject) => {
        const token = setTimeout(resolve, ms)
        cancellationToken.register(() => {
            clearTimeout(token)
            reject(new CancelError("Cancelled"))
        })
    })

const getRandomDelay = (min: number, max: number) => Math.floor(Math.random() * (max - min) + min)

const getNowTimestamp = () => Date.now() / 1000

const workers = ["worker@1-123", "worker@2-123", "worker@3-123"]

const sendTask = (task: Task) => {
    handleEvent({
        type: EventType.TASK_SENT,
        category: EventCategory.TASK,
        data: task,
    })
}

const receiveTask = (task: Task) => {
    task.state = TaskState.RECEIVED
    task.received_at = getNowTimestamp()
    task.last_updated = getNowTimestamp()
    task.worker = workers[Math.floor(Math.random() * workers.length)]
    handleEvent({
        type: EventType.TASK_RECEIVED,
        category: EventCategory.TASK,
        data: task,
    })
}

const startTask = (task: Task) => {
    task.state = TaskState.STARTED
    task.started_at = getNowTimestamp()
    task.last_updated = getNowTimestamp()
    handleEvent({
        type: EventType.TASK_STARTED,
        category: EventCategory.TASK,
        data: task,
    })
}

const finishTask = (task: Task) => {
    task.state = TaskState.SUCCESS
    task.succeeded_at = getNowTimestamp()
    task.last_updated = getNowTimestamp()
    task.runtime = task.started_at ? task.started_at - task.succeeded_at : 0
    handleEvent({
        type: EventType.TASK_SUCCEEDED,
        category: EventCategory.TASK,
        data: task,
    })
}
const errorTask = (task: Task) => {
    task.state = TaskState.FAILURE
    task.failed_at = getNowTimestamp()
    task.last_updated = getNowTimestamp()
    const { exception, traceback } = getRandomException()
    task.exception = exception
    task.traceback = traceback
    handleEvent({
        type: EventType.TASK_FAILED,
        category: EventCategory.TASK,
        data: task,
    })
}

export interface SimulatorTaskOptions {
    name: string
    children?: SimulatorTaskOptions[]
    errorRate?: number
}

interface SimulatorContext {
    rootId: string
    parentId: string
}

const createTask = (options: SimulatorTaskOptions): Task => ({
    id: uuidv4(),
    type: options.name,
    state: TaskState.PENDING,
    sent_at: getNowTimestamp(),
    last_updated: getNowTimestamp(),
    children: [],
})

export const simulateTask = async (
    options: SimulatorTaskOptions,
    cancellationToken: CancellationToken,
    context?: SimulatorContext,
) => {
    const task = createTask(options)
    if (context) {
        task.root_id = context.rootId
        task.parent_id = context.parentId
        context = {
            rootId: context.rootId,
            parentId: task.id,
        }
    } else {
        context = {
            rootId: task.id,
            parentId: task.id,
        }
    }

    // Simulate task being sent
    sendTask(task)

    // Simulate task being received
    await delay(getRandomDelay(0, 1_000), cancellationToken)
    receiveTask(task)

    // Simulate task starting
    await delay(getRandomDelay(0, 3_000), cancellationToken)
    startTask(task)

    // Simulate task finishing or failing
    await delay(getRandomDelay(5_000, 30_000), cancellationToken)
    const isError = Math.random() < (options.errorRate || 5) / 100
    if (isError) {
        errorTask(task)
        return
    }

    finishTask(task)

    if (options.children)
        await Promise.all(
            options.children?.map((childOptions) => simulateTask(childOptions, cancellationToken, context)),
        )
}

export const simulateWorkflow = (options: SimulatorTaskOptions, interval: number) => {
    const cancellationToken = new CancellationToken()
    const handleError = (error: unknown) => {
        if (!(error instanceof CancelError)) console.warn("Error while simulating task", options, error)
    }
    simulateTask(options, cancellationToken).catch(handleError)
    const token = setInterval(() => {
        simulateTask(options, cancellationToken).catch(handleError)
    }, interval)
    return () => {
        clearInterval(token)
        cancellationToken.cancel()
    }
}
