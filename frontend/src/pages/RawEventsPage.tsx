import WsStateIcon from "@components/common/WsStateIcon"
import { CeleryEvent, useRawEvents } from "@hooks/useRawEvents"
import { ExplorerLayout } from "@layout/explorer/ExplorerLayout"
import { useTheme } from "@mui/material"
import Typography from "@mui/material/Typography"
import { JsonViewer } from "@textea/json-viewer"
import React from "react"

interface RawEventRowProps {
    event: CeleryEvent
}

const RawEventRow: React.FC<RawEventRowProps> = ({ event }) => {
    const theme = useTheme()
    return (
        <JsonViewer theme={theme.palette.mode} editable={false} rootName={false} quotesOnKeys={false} value={event} />
    )
}

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
                {events.map((event, index) => (
                    <RawEventRow key={index} event={event} />
                ))}
            </ExplorerLayout>
        </>
    )
}
export default RawEventsPage
