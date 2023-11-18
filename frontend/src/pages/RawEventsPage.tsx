import WsStateIcon from "@components/common/WsStateIcon"
import { LimitSelect } from "@components/raw_events/LimitSelect"
import { RawEventsTable } from "@components/raw_events/RawEventsTable"
import { ToggleConnect } from "@components/raw_events/ToggleConnect"
import { useRawEvents } from "@hooks/useRawEvents"
import { ExplorerLayout } from "@layout/explorer/ExplorerLayout"
import Typography from "@mui/material/Typography"
import React, { useState } from "react"

const RawEventsPage: React.FC = () => {
    const [limit, setLimit] = useState(100)
    const [connect, setConnect] = useState(true)
    const { events, readyState } = useRawEvents(connect, limit)

    return (
        <>
            <ExplorerLayout
                actions={
                    <>
                        <WsStateIcon state={readyState} />
                        <Typography variant="subtitle2" noWrap>
                            {events.length} Events
                        </Typography>
                        <LimitSelect limit={limit} setLimit={setLimit} />
                        <ToggleConnect connect={connect} setConnect={setConnect} />
                    </>
                }
            >
                <RawEventsTable events={events} />
            </ExplorerLayout>
        </>
    )
}
export default RawEventsPage
