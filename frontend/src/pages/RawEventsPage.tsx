import { useRawEvents } from "@hooks/useRawEvents"
import Typography from "@mui/material/Typography"
import React from "react"

const RawEventsPage: React.FC = () => {
    const { events, readyState } = useRawEvents(100)
    return (
        <>
            <Typography>Status: {readyState}</Typography>
            <ul>
                {events.map((event, index) => (
                    <li key={index}>{JSON.stringify(event)}</li>
                ))}
            </ul>
        </>
    )
}
export default RawEventsPage
