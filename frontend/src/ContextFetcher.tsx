import React, { useEffect } from "react"
import { useSetRecoilState } from "recoil"
import { tasksState } from "./atoms/tasks"
import { ServerClient } from "./services/server"

interface ContextFetcherProps {
    children: React.ReactNode
}

const ContextFetcher: React.FC<ContextFetcherProps> = ({ children }) => {
    const setTasksState = useSetRecoilState(tasksState)

    useEffect(() => {
        new ServerClient({ BASE: "http://localhost:8555" }).api
            .getTasks()
            .then((response) => setTasksState(response.results))
    })

    return <>{children}</>
}

export default ContextFetcher
