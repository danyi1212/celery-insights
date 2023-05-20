import { ServerClient, Task, TaskEventMessage, WorkerEventMessage } from "@services/server"
import { StateTask, StateWorker, translateTask, translateWorker } from "@utils/translateServerModels"
import { LRUCache } from "lru-cache"
import { ReadyState } from "react-use-websocket"
import { create } from "zustand"

interface State {
    tasks: LRUCache<string, StateTask>
    recentTaskIds: string[]
    recentTasksCapacity: number
    workers: LRUCache<string, StateWorker>
    status: ReadyState
}

export const useStateStore = create<State>(() => ({
    tasks: new LRUCache({ max: 1000 }),
    recentTaskIds: [],
    recentTasksCapacity: 30,
    workers: new LRUCache({ max: 100 }),
    status: ReadyState.UNINSTANTIATED,
}))

export const loadInitialState = () => {
    new ServerClient().tasks.getTasks().then((response) => {
        useStateStore.setState((state) => {
            response.results.forEach((task) => state.tasks.set(task.id, translateTask(task)))
            return {
                tasks: state.tasks,
                recentTaskIds: response.results.slice(0, state.recentTasksCapacity).map((task) => task.id),
            }
        })
    })
    new ServerClient().workers.getWorkers().then((response) => {
        useStateStore.setState((state) => {
            response.forEach((worker) => state.workers.set(worker.id, translateWorker(worker)))
            return { workers: state.workers }
        })
    })
}

const addTask = (task: Task) =>
    useStateStore.setState((state) => {
        const stateTask = translateTask(task)
        const recentTaskIds = state.tasks.has(task.id)
            ? state.recentTaskIds
            : [task.id, ...state.recentTaskIds.slice(0, state.recentTasksCapacity - 1)]
        return {
            tasks: state.tasks.set(task.id, stateTask),
            recentTaskIds: recentTaskIds,
        }
    })

export const handleEvent = (message: TaskEventMessage | WorkerEventMessage) => {
    switch (message.category) {
        case TaskEventMessage.category.TASK: {
            return addTask(message.task)
        }
        case WorkerEventMessage.category.WORKER: {
            return useStateStore.setState((state) => ({
                workers: state.workers.set(message.worker.id, translateWorker(message.worker)),
            }))
        }
    }
}

export const resetState = () =>
    useStateStore.setState((state) => {
        state.tasks.clear()
        state.workers.clear()
        return {
            recentTaskIds: [],
        }
    })
