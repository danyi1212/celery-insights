import { atom } from "recoil"
import { Task } from "../services/server"

export const tasksState = atom<Task[]>({
    key: "tasks",
    default: [],
})
