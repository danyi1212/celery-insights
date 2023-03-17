import {
    handleEvent,
    loadInitialState,
    useStateStore,
} from "@stores/useStateStore"
import React, { useEffect } from "react"
import useWebSocket from "react-use-websocket"

const toWsUri = (path: string): string => {
    const location = window.location
    const protocol = location.protocol === "https:" ? "wss:" : "ws:"
    return `${protocol}//${location.host}/${path}`
}

const CeleryStateSync: React.FC = () => {
    const { readyState } = useWebSocket(toWsUri("ws/events"), {
        shouldReconnect: () => true,
        onOpen: () => console.log("Connected to websockets!"),
        onClose: () => console.log("Disconnected from websockets!"),
        onError: (error) =>
            console.log("Error connecting to websockets!", error),
        onReconnectStop: (numAttempts) =>
            console.log(
                `Out of attempts to reconnected websockets (${numAttempts})`
            ),
        onMessage: (event) => {
            const message = JSON.parse(event.data)
            handleEvent(message)
        },
    })

    useEffect(() => {
        useStateStore.setState({ status: readyState })
    }, [readyState])

    useEffect(() => {
        loadInitialState()
    }, [])

    return <></>
}

export default CeleryStateSync
