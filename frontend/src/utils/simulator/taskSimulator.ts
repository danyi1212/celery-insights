import { EventType, Task, TaskEventMessage, TaskState } from "@services/server"
import { handleEvent } from "@stores/useStateStore"
import { getRandomException } from "@utils/simulator/exceptionSimulator"
import { v4 as uuidv4 } from "uuid"

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const getRandomDelay = (min: number, max: number) => Math.floor(Math.random() * (max - min) + min)

const workers = ["worker@1-123", "worker@2-123", "worker@3-123"]

const sendTask = (task: Task) => {
    handleEvent({
        type: EventType.TASK_SENT,
        category: TaskEventMessage.category.TASK,
        task: task,
    })
}

const receiveTask = (task: Task) => {
    task.state = TaskState.RECEIVED
    task.received_at = new Date().getTime()
    task.last_updated = new Date().getTime()
    task.worker = workers[Math.floor(Math.random() * workers.length)]
    handleEvent({
        type: EventType.TASK_RECEIVED,
        category: TaskEventMessage.category.TASK,
        task: task,
    })
}

const startTask = (task: Task) => {
    task.state = TaskState.STARTED
    task.started_at = new Date().getTime()
    task.last_updated = new Date().getTime()
    handleEvent({
        type: EventType.TASK_STARTED,
        category: TaskEventMessage.category.TASK,
        task: task,
    })
}

const finishTask = (task: Task) => {
    task.last_updated = new Date().getTime()
    task.state = TaskState.SUCCESS
    task.succeeded_at = new Date().getTime()
    task.runtime = task.started_at ? task.started_at - task.succeeded_at : 0
    handleEvent({
        type: EventType.TASK_SUCCEEDED,
        category: TaskEventMessage.category.TASK,
        task: task,
    })
}
const errorTask = (task: Task) => {
    task.last_updated = new Date().getTime()
    task.state = TaskState.FAILURE
    task.failed_at = new Date().getTime()
    const { exception, traceback } = getRandomException()
    task.exception = exception
    task.traceback = traceback
    handleEvent({
        type: EventType.TASK_FAILED,
        category: TaskEventMessage.category.TASK,
        task: task,
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
    sent_at: new Date().getTime(),
    last_updated: new Date().getTime(),
    children: [],
})

export const simulateTask = async (options: SimulatorTaskOptions, context?: SimulatorContext) => {
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
    await delay(getRandomDelay(0, 1_000))
    receiveTask(task)

    // Simulate task starting
    await delay(getRandomDelay(0, 3_000))
    startTask(task)

    // Simulate task finishing or failing
    await delay(getRandomDelay(5_000, 30_000))
    const isError = Math.random() < (options.errorRate || 5) / 100
    if (isError) {
        errorTask(task)
        return
    }

    finishTask(task)

    if (options.children)
        await Promise.all(options.children?.map((childOptions) => simulateTask(childOptions, context)))
}

export const simulateWorkflow = (options: SimulatorTaskOptions, interval: number) => {
    simulateTask(options).then()
    const token = setInterval(async () => simulateTask(options), interval)
    return () => clearInterval(token)
}
