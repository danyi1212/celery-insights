import TaskAvatar from "@components/task/TaskAvatar"
import { CeleryEvent } from "@hooks/useRawEvents"
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown"
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp"
import { useTheme } from "@mui/material"
import Collapse from "@mui/material/Collapse"
import IconButton from "@mui/material/IconButton"
import TableCell from "@mui/material/TableCell"
import TableRow from "@mui/material/TableRow"
import { JsonViewer } from "@textea/json-viewer"
import { format } from "date-fns"
import React from "react"

interface RawEventRowProps {
    event: CeleryEvent
}

export const RawEventRow: React.FC<RawEventRowProps> = ({ event }) => {
    const [open, setOpen] = React.useState(false)

    const theme = useTheme()
    return (
        <>
            <TableRow sx={{ "& > *": { borderBottom: "unset" } }}>
                <TableCell>
                    {event?.uuid ? (
                        <TaskAvatar taskId={event.uuid.toString()} type={event?.name as string} />
                    ) : (
                        <TaskAvatar taskId="worker" type={event?.hostname as string} />
                    )}
                </TableCell>
                <TableCell>
                    {event?.timestamp ? format(event.timestamp as number, "hh:mm:ss.SSS") : "Unknown"}
                </TableCell>
                <TableCell>{(event?.type as string) || "Unknown"}</TableCell>
                <TableCell>{(event?.name as string) || (event?.hostname as string) || "Unknown"}</TableCell>
                <TableCell>
                    <IconButton aria-label="Expand raw event" size="small" onClick={() => setOpen(!open)}>
                        {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    </IconButton>
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                        <JsonViewer
                            theme={theme.palette.mode}
                            editable={false}
                            rootName={false}
                            quotesOnKeys={false}
                            value={event}
                        />
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    )
}
