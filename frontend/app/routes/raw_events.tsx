import { createFileRoute } from "@tanstack/react-router"
import WsStateIcon from "@components/common/ws-state-icon"
import Facet from "@components/explorer/facet"
import { LimitSelect } from "@components/raw_events/limit-select"
import { RawEventsTable } from "@components/raw_events/raw-events-table"
import { ToggleConnect } from "@components/raw_events/toggle-connect"
import { useSurrealDB } from "@components/surrealdb-provider"
import { useLiveEvents } from "@hooks/use-live-events"
import { ExplorerLayout } from "@layout/explorer/explorer-layout"
import useSettingsStore from "@stores/use-settings-store"
import { countUniqueProperties } from "@utils/count-unique-properties"
import { Loader2 } from "lucide-react"
import type { SurrealEvent } from "@/types/surreal-records"
import { ReadyState } from "react-use-websocket"
import React, { useEffect, useMemo, useState } from "react"

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

const filterEventTypes = (event: SurrealEvent, selectedTypes: string[]) =>
    selectedTypes.length == 0 || (event?.event_type && selectedTypes.includes(event?.event_type as string))

const RawEventsPage = () => {
    const { status } = useSurrealDB()
    const isDemo = useSettingsStore((state) => state.demo)
    const limit = useSettingsStore((state) => state.rawEventsLimit)
    const [connect, setConnect] = useState(!isDemo)
    const { data: liveEvents, isLoading } = useLiveEvents(limit, connect && !isDemo)
    const [frozenEvents, setFrozenEvents] = useState<SurrealEvent[]>([])
    const [selectedTypes, setSelectedTypes] = useState<string[]>([])

    useEffect(() => {
        if (connect && !isDemo && !isLoading) {
            setFrozenEvents(liveEvents)
        }
    }, [connect, isDemo, isLoading, liveEvents])

    const events = connect && !isDemo ? liveEvents : frozenEvents
    const groups = useMemo(() => countUniqueProperties(events, ["event_type"]), [events])
    const filteredEvents = useMemo(
        () => events.filter((event) => filterEventTypes(event, selectedTypes)),
        [events, selectedTypes],
    )
    const readyState = !connect
        ? ReadyState.CLOSED
        : status === "connected"
          ? ReadyState.OPEN
          : status === "connecting" || status === "reconnecting"
            ? ReadyState.CONNECTING
            : ReadyState.CLOSED

    return (
        <>
            <ExplorerLayout
                actions={
                    <>
                        <WsStateIcon state={readyState} isDemo={isDemo} />
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
