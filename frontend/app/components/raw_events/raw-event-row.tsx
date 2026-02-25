import TaskAvatar from "@components/task/task-avatar"
import { Button } from "@components/ui/button"
import { TableCell, TableRow } from "@components/ui/table"
import { useIsDark } from "@hooks/use-is-dark"
import JsonView from "@uiw/react-json-view"
import { githubDarkTheme } from "@uiw/react-json-view/githubDark"
import { githubLightTheme } from "@uiw/react-json-view/githubLight"
import { format } from "date-fns"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { SurrealEvent } from "@/types/surreal-records"
import React, { useMemo } from "react"

interface RawEventRowProps {
    event: SurrealEvent
}

export const RawEventRow: React.FC<RawEventRowProps> = ({ event }) => {
    const [open, setOpen] = React.useState(false)
    const isDark = useIsDark()
    const parsedData = useMemo(() => {
        const raw = event.data
        if (!raw) return null
        if (typeof raw === "string") {
            try {
                return JSON.parse(raw) as Record<string, unknown>
            } catch {
                return null
            }
        }
        if (typeof raw === "object") return raw as Record<string, unknown>
        return null
    }, [event.data])

    const taskId = event.task_id ?? (parsedData?.uuid ? String(parsedData.uuid) : undefined)
    const taskName = typeof parsedData?.name === "string" ? parsedData.name : undefined
    const rawHostname = event.hostname
    const hostname =
        typeof rawHostname === "string"
            ? rawHostname
            : typeof parsedData?.hostname === "string"
              ? parsedData.hostname
              : undefined
    const eventType = event.event_type ?? (typeof parsedData?.type === "string" ? parsedData.type : undefined)
    const timestamp = event.timestamp ? new Date(event.timestamp) : null
    const timestampLabel =
        timestamp && !Number.isNaN(timestamp.getTime()) ? format(timestamp, "HH:mm:ss.SSS") : "Unknown"

    return (
        <>
            <TableRow className="[&>td]:border-b-0">
                <TableCell>
                    {taskId ? (
                        <TaskAvatar taskId={taskId} type={taskName || hostname} />
                    ) : (
                        <TaskAvatar taskId="worker" type={hostname} />
                    )}
                </TableCell>
                <TableCell>
                    {timestampLabel}
                </TableCell>
                <TableCell>{eventType || "Unknown"}</TableCell>
                <TableCell>{taskName || hostname || "Unknown"}</TableCell>
                <TableCell>
                    <Button variant="ghost" size="icon-xs" aria-label="Expand raw event" onClick={() => setOpen(!open)}>
                        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </Button>
                </TableCell>
            </TableRow>
            {open && (
                <TableRow>
                    <TableCell colSpan={5} className="p-2">
                        <JsonView
                            value={parsedData ?? event}
                            style={isDark ? githubDarkTheme : githubLightTheme}
                            displayDataTypes={false}
                            enableClipboard={false}
                        />
                    </TableCell>
                </TableRow>
            )}
        </>
    )
}
