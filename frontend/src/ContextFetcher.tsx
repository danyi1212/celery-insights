import React, { useEffect } from "react"
import useWebSocket from "react-use-websocket"
import { useSetRecoilState } from "recoil"
import { tasksState } from "./atoms/tasks"
import { ServerClient } from "./services/server"

interface ContextFetcherProps {
    children: React.ReactNode
}

const ContextFetcher: React.FC<ContextFetcherProps> = ({ children }) => {
    const setTasksState = useSetRecoilState(tasksState)
    useWebSocket("ws://localhost:8555/ws/events", {
        shouldReconnect: () => true,
        onOpen: () => console.log("Connected to websockets!"),
        onClose: () => console.log("Disconnected from websockets!"),
        onError: (error) =>
            console.log("Error connecting to websockets!", error),
        onReconnectStop: (numAttempts) =>
            console.log(
                `Out of attempts to reconnected websockets (${numAttempts})`
            ),
        onMessage: (message) => console.log(JSON.parse(message.data)),
    })

    useEffect(() => {
        new ServerClient({ BASE: "http://localhost:8555" }).api
            .getTasks()
            .then((response) =>
                setTasksState(
                    new Map(response.results.map((task) => [task.id, task]))
                )
            )
    }, [setTasksState])

    return <>{children}</>
}

export default ContextFetcher
