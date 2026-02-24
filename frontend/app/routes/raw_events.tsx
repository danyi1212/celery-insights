import { createFileRoute } from "@tanstack/react-router"
import WsStateIcon from "@components/common/WsStateIcon"
import Facet from "@components/explorer/Facet"
import { LimitSelect } from "@components/raw_events/LimitSelect"
import { RawEventsTable } from "@components/raw_events/RawEventsTable"
import { ToggleConnect } from "@components/raw_events/ToggleConnect"
import { CeleryEvent, useRawEvents } from "@hooks/useRawEvents"
import { ExplorerLayout } from "@layout/explorer/ExplorerLayout"
import useSettingsStore from "@stores/useSettingsStore"
import { countUniqueProperties } from "@utils/CountUniqueProperties"
import { Loader2 } from "lucide-react"
import React, { useMemo, useState } from "react"

interface PlaceholderProps {
    text: React.ReactNode
    progress?: boolean
}

const Placeholder: React.FC<PlaceholderProps> = ({ text, progress }) => {
    return (
        <div className="my-10 flex items-center justify-center gap-3">
            {progress && <Loader2 className="size-8 animate-spin text-muted-foreground" />}
            <h5 className="text-xl font-semibold">{text}</h5>
        </div>
    )
}

const filterEventTypes = (event: CeleryEvent, selectedTypes: string[]) =>
    selectedTypes.length == 0 || (event?.type && selectedTypes.includes(event?.type as string))

const RawEventsPage = () => {
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
                        <span className="text-sm font-medium truncate">{events.length} Events</span>
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

export const Route = createFileRoute("/raw_events")({
    component: RawEventsPage,
})
