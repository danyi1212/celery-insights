import { Task } from "@services/server"
import { atom } from "recoil"

export const tasksState = atom<Map<string, Task>>({
    key: "tasks",
    default: new Map(),
})
