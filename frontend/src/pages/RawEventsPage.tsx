import WsStateIcon from "@components/common/WsStateIcon"
import { LimitSelect } from "@components/raw_events/LimitSelect"
import { RawEventsTable } from "@components/raw_events/RawEventsTable"
import { ToggleConnect } from "@components/raw_events/ToggleConnect"
import { useRawEvents } from "@hooks/useRawEvents"
import { ExplorerLayout } from "@layout/explorer/ExplorerLayout"
import CircularProgress from "@mui/material/CircularProgress"
import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"
import useSettingsStore from "@stores/useSettingsStore"
import React, { useState } from "react"

interface PlaceholderProps {
    text: React.ReactNode
    progress?: boolean
}

const Placeholder: React.FC<PlaceholderProps> = ({ text, progress }) => {
    return (
        <Stack direction="row" justifyContent="center" alignItems="center" spacing={3} my={10}>
            {progress && <CircularProgress />}
            <Typography variant="h5">{text}</Typography>
        </Stack>
    )
}

const RawEventsPage: React.FC = () => {
    const isDemo = useSettingsStore((state) => state.demo)
    const [limit, setLimit] = useState(100)
    const [connect, setConnect] = useState(!isDemo)
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
                        <ToggleConnect connect={connect} setConnect={setConnect} disabled={isDemo} />
                    </>
                }
            >
                {isDemo ? (
                    <Placeholder text="Live Events are not available in Demo Mode." />
                ) : events.length === 0 ? (
                    <Placeholder progress text="Waiting for events..." />
                ) : (
                    <RawEventsTable events={events} />
                )}
            </ExplorerLayout>
        </>
    )
}
export default RawEventsPage
