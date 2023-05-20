import { EventType, Task, TaskEventMessage, TaskState } from "@services/server"
import { handleEvent } from "@stores/useStateStore"
import { getRandomException } from "@utils/simulator/exceptionSimulator"
import { v4 as uuidv4 } from "uuid"

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const getRandomDelay = (min: number, max: number) => Math.floor(Math.random() * (max - min) + min)

const createTask = (type: string): Task => ({
    id: uuidv4(),
    type: type,
    state: TaskState.PENDING,
    sent_at: new Date().getTime(),
    last_updated: new Date().getTime(),
    children: [],
})

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

const ERROR_RATE = 0.05
const finishTask = (task: Task) => {
    const success = Math.random() < 1 - ERROR_RATE
    task.last_updated = new Date().getTime()
    if (success) {
        task.state = TaskState.SUCCESS
        task.succeeded_at = new Date().getTime()
        handleEvent({
            type: EventType.TASK_SUCCEEDED,
            category: TaskEventMessage.category.TASK,
            task: task,
        })
    } else {
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
}

export const simulateTask = async (type: string) => {
    const task = createTask(type)

    // Simulate task being sent
    sendTask(task)

    // Simulate task being received
    await delay(getRandomDelay(0, 1000))
    receiveTask(task)

    // Simulate task starting
    await delay(getRandomDelay(0, 1000))
    startTask(task)

    // Simulate task finishing or failing
    await delay(getRandomDelay(0, 30000))
    finishTask(task)
}
