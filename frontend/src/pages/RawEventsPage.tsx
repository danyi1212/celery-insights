import WsStateIcon from "@components/common/WsStateIcon"
import { useRawEvents } from "@hooks/useRawEvents"
import { ExplorerLayout } from "@layout/explorer/ExplorerLayout"
import Typography from "@mui/material/Typography"
import React from "react"

const RawEventsPage: React.FC = () => {
    const { events, readyState } = useRawEvents(100)
    return (
        <>
            <ExplorerLayout
                actions={
                    <>
                        <WsStateIcon state={readyState} />
                        <Typography variant="subtitle2">{events.length} Events</Typography>
                    </>
                }
            >
                <ul>
                    {events.map((event, index) => (
                        <li key={index}>{JSON.stringify(event)}</li>
                    ))}
                </ul>
            </ExplorerLayout>
        </>
    )
}
export default RawEventsPage
