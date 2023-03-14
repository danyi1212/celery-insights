import { atom } from "recoil"
import { Task } from "../services/server"

export const tasksState = atom<Map<string, Task>>({
    key: "tasks",
    default: new Map(),
})
