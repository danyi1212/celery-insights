import { ServerClient, Task, TaskEventMessage, Worker, WorkerEventMessage } from "@services/server"
import { ReadyState } from "react-use-websocket"
import { create } from "zustand"

interface State {
    tasks: Map<string, Task>
    workers: Map<string, Worker>
    status: ReadyState
}

export const useStateStore = create<State>(() => ({
    tasks: new Map(),
    workers: new Map(),
    status: ReadyState.UNINSTANTIATED,
}))

export const loadInitialState = () => {
    new ServerClient().tasks.getTasks().then((response) => {
        console.log(`Loaded ${response.results.length} tasks`)
        useStateStore.setState({
            tasks: new Map(response.results.map((task) => [task.id, task])),
        })
    })
    new ServerClient().workers.getWorkers().then((response) => {
        console.log(`Loaded ${response.length} workers`)
        useStateStore.setState({
            workers: new Map(response.map((worker) => [worker.id, worker])),
        })
    })
}

export const handleEvent = (message: TaskEventMessage | WorkerEventMessage) => {
    switch (message.category) {
        case TaskEventMessage.category.TASK: {
            return useStateStore.setState((state) => ({
                tasks: new Map(state.tasks).set(message.task.id, message.task),
            }))
        }
        case WorkerEventMessage.category.WORKER: {
            return useStateStore.setState((state) => ({
                workers: new Map(state.workers).set(message.worker.id, message.worker),
            }))
        }
    }
}
