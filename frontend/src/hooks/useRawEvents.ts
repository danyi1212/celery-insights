import { toWebSocketUri } from "@utils/webSocketUtils"
import { useState } from "react"
import useWebSocket from "react-use-websocket"

export type CeleryEvent = Record<string, unknown>

export const useRawEvents = (limit: number) => {
    const [events, setEvents] = useState<CeleryEvent[]>([])
    const { readyState } = useWebSocket(toWebSocketUri("ws/raw_events"), {
        shouldReconnect: () => true,
        share: true,
        onError: (error) => console.error("Error connecting to websockets!", error),
        onReconnectStop: (numAttempts) => console.error(`Out of attempts to reconnected websockets (${numAttempts})`),
        onMessage: (event) => {
            const message = JSON.parse(event.data)
            setEvents((state) => [message, ...state.slice(0, limit - 1)])
        },
    })
    return { events, readyState }
}
