import { handleEvent, loadInitialState } from "@stores/useStateStore"
import React, { useEffect } from "react"
import useWebSocket from "react-use-websocket"

const CeleryStateSync: React.FC = () => {
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
        onMessage: (event) => {
            const message = JSON.parse(event.data)
            handleEvent(message)
        },
    })

    useEffect(() => {
        loadInitialState()
    }, [])

    return <></>
}

export default CeleryStateSync
