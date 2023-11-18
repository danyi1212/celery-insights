import WsStateIcon from "@components/common/WsStateIcon"
import { LimitSelect } from "@components/raw_events/LimitSelect"
import { RawEventsTable } from "@components/raw_events/RawEventsTable"
import { useRawEvents } from "@hooks/useRawEvents"
import { ExplorerLayout } from "@layout/explorer/ExplorerLayout"
import Typography from "@mui/material/Typography"
import React, { useState } from "react"

const RawEventsPage: React.FC = () => {
    const [limit, setLimit] = useState(100)
    const { events, readyState } = useRawEvents(limit)
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
                    </>
                }
            >
                <RawEventsTable events={events} />
            </ExplorerLayout>
        </>
    )
}
export default RawEventsPage
