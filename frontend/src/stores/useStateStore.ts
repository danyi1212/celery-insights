import { ServerClient, Task, TaskEventMessage, Worker, WorkerEventMessage } from "@services/server"
import { LRUMap } from "@utils/LRUMap"
import { ReadyState } from "react-use-websocket"
import { create } from "zustand"

interface State {
    tasks: LRUMap<string, Task>
    workers: LRUMap<string, Worker>
    status: ReadyState
}

export const useStateStore = create<State>(() => ({
    tasks: new LRUMap(1000),
    workers: new LRUMap(100),
    status: ReadyState.UNINSTANTIATED,
}))

export const loadInitialState = () => {
    new ServerClient().tasks.getTasks().then((response) => {
        console.log(`Loaded ${response.results.length} tasks`)
        useStateStore.setState((state) => {
            const tasks = new LRUMap(state.tasks)
            response.results.forEach((task) => tasks.set(task.id, task))
            return { tasks }
        })
    })
    new ServerClient().workers.getWorkers().then((response) => {
        console.log(`Loaded ${response.length} workers`)
        useStateStore.setState((state) => {
            const workers = new LRUMap(state.workers)
            response.forEach((worker) => workers.set(worker.id, worker))
            return { workers }
        })
    })
}

export const handleEvent = (message: TaskEventMessage | WorkerEventMessage) => {
    switch (message.category) {
        case TaskEventMessage.category.TASK: {
            return useStateStore.setState((state) => ({
                tasks: state.tasks.iset(message.task.id, message.task),
            }))
        }
        case WorkerEventMessage.category.WORKER: {
            return useStateStore.setState((state) => ({
                workers: state.workers.iset(message.worker.id, message.worker),
            }))
        }
    }
}
