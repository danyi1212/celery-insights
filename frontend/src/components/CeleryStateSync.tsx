import { handleEvent, loadInitialState, useStateStore } from "@stores/useStateStore"
import { toWebSocketUri } from "@utils/webSocketUtils"
import React, { useEffect } from "react"
import useWebSocket from "react-use-websocket"

const CeleryStateSync: React.FC = () => {
    const { readyState } = useWebSocket(toWebSocketUri("ws/events"), {
        shouldReconnect: () => true,
        onError: (error) => console.error("Error connecting to websockets!", error),
        onReconnectStop: (numAttempts) => console.error(`Out of attempts to reconnected websockets (${numAttempts})`),
        onMessage: (event) => {
            const message = JSON.parse(event.data)
            handleEvent(message)
        },
        filter: () => false, // Reduce re-renders
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
