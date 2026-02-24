import TaskAvatar from "@components/task/task-avatar"
import { Button } from "@components/ui/button"
import { TableCell, TableRow } from "@components/ui/table"
import { useIsDark } from "@hooks/use-is-dark"
import { CeleryEvent } from "@hooks/use-raw-events"
import JsonView from "@uiw/react-json-view"
import { githubDarkTheme } from "@uiw/react-json-view/githubDark"
import { githubLightTheme } from "@uiw/react-json-view/githubLight"
import { format } from "date-fns"
import { ChevronDown, ChevronUp } from "lucide-react"
import React from "react"

interface RawEventRowProps {
    event: CeleryEvent
}

export const RawEventRow: React.FC<RawEventRowProps> = ({ event }) => {
    const [open, setOpen] = React.useState(false)
    const isDark = useIsDark()

    return (
        <>
            <TableRow className="[&>td]:border-b-0">
                <TableCell>
                    {event?.uuid ? (
                        <TaskAvatar taskId={event.uuid.toString()} type={event?.name as string} />
                    ) : (
                        <TaskAvatar taskId="worker" type={event?.hostname as string} />
                    )}
                </TableCell>
                <TableCell>
                    {event?.timestamp ? format(event.timestamp as number, "HH:mm:ss.SSS") : "Unknown"}
                </TableCell>
                <TableCell>{(event?.type as string) || "Unknown"}</TableCell>
                <TableCell>{(event?.name as string) || (event?.hostname as string) || "Unknown"}</TableCell>
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
                            value={event}
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
