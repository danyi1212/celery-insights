import WsStateIcon from "@components/common/WsStateIcon"
import { RawEventsTable } from "@components/raw_events/RawEventsTable"
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
                <RawEventsTable events={events} />
            </ExplorerLayout>
        </>
    )
}
export default RawEventsPage
