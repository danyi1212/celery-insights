import { ServerClient, Task, TaskEventMessage, WorkerEventMessage } from "@services/server"
import { LRUMap } from "@utils/LRUMap"
import { StateTask, StateWorker, translateTask, translateWorker } from "@utils/translateServerModels"
import { ReadyState } from "react-use-websocket"
import { create } from "zustand"

interface State {
    tasks: LRUMap<string, StateTask>
    recentTaskIds: string[]
    recentTasksCapacity: number
    workers: LRUMap<string, StateWorker>
    status: ReadyState
}

export const useStateStore = create<State>(() => ({
    tasks: new LRUMap(1000),
    recentTaskIds: [],
    recentTasksCapacity: 30,
    workers: new LRUMap(100),
    status: ReadyState.UNINSTANTIATED,
}))

export const loadInitialState = () => {
    new ServerClient().tasks.getTasks().then((response) => {
        useStateStore.setState((state) => {
            const tasks = new LRUMap(state.tasks)
            response.results.forEach((task) => tasks.set(task.id, translateTask(task)))
            return { tasks, recentTaskIds: response.results.slice(0, state.recentTasksCapacity).map((task) => task.id) }
        })
    })
    new ServerClient().workers.getWorkers().then((response) => {
        useStateStore.setState((state) => {
            const workers = new LRUMap(state.workers)
            response.forEach((worker) => workers.set(worker.id, translateWorker(worker)))
            return { workers }
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
            tasks: state.tasks.iset(task.id, stateTask),
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
                workers: state.workers.iset(message.worker.id, translateWorker(message.worker)),
            }))
        }
    }
}
