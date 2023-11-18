import WsStateIcon from "@components/common/WsStateIcon"
import Facet from "@components/explorer/Facet"
import { LimitSelect } from "@components/raw_events/LimitSelect"
import { RawEventsTable } from "@components/raw_events/RawEventsTable"
import { ToggleConnect } from "@components/raw_events/ToggleConnect"
import { CeleryEvent, useRawEvents } from "@hooks/useRawEvents"
import { ExplorerLayout } from "@layout/explorer/ExplorerLayout"
import CircularProgress from "@mui/material/CircularProgress"
import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"
import useSettingsStore from "@stores/useSettingsStore"
import { countUniqueProperties } from "@utils/CountUniqueProperties"
import React, { useMemo, useState } from "react"

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

const filterEventTypes = (event: CeleryEvent, selectedTypes: string[]) =>
    selectedTypes.length == 0 || (event?.type && selectedTypes.includes(event?.type as string))

const RawEventsPage: React.FC = () => {
    const isDemo = useSettingsStore((state) => state.demo)
    const limit = useSettingsStore((state) => state.rawEventsLimit)
    const [connect, setConnect] = useState(!isDemo)
    const { events, readyState } = useRawEvents(connect, limit)
    const [selectedTypes, setSelectedTypes] = useState<string[]>([])
    const groups = useMemo(() => countUniqueProperties(events, ["type"]), [events])
    const filteredEvents = useMemo(
        () => events.filter((event) => filterEventTypes(event, selectedTypes)),
        [events, selectedTypes],
    )

    return (
        <>
            <ExplorerLayout
                actions={
                    <>
                        <WsStateIcon state={readyState} />
                        <Typography variant="subtitle2" noWrap>
                            {events.length} Events
                        </Typography>
                        <ToggleConnect connect={connect} setConnect={setConnect} disabled={isDemo} />
                        <LimitSelect
                            limit={limit}
                            setLimit={(newLimit) => useSettingsStore.setState({ rawEventsLimit: newLimit })}
                        />
                    </>
                }
                facets={
                    <Facet
                        title="Event types"
                        counts={groups.get("type") || new Map()}
                        selected={new Set(selectedTypes)}
                        setSelected={(values) => setSelectedTypes([...values.values()])}
                    />
                }
            >
                {isDemo ? (
                    <Placeholder text="Live Events are not available in Demo Mode." />
                ) : events.length === 0 ? (
                    <Placeholder progress text="Waiting for events..." />
                ) : (
                    <RawEventsTable events={filteredEvents} />
                )}
            </ExplorerLayout>
        </>
    )
}
export default RawEventsPage
