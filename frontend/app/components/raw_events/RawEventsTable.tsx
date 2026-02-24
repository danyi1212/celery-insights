import { RawEventRow } from "@components/raw_events/RawEventRow"
import { CeleryEvent } from "@hooks/useRawEvents"
import Table from "@mui/material/Table"
import TableBody from "@mui/material/TableBody"
import TableCell from "@mui/material/TableCell"
import TableContainer from "@mui/material/TableContainer"
import TableHead from "@mui/material/TableHead"
import TableRow from "@mui/material/TableRow"
import React from "react"

interface RawEventsTableProps {
    events: CeleryEvent[]
}

export const RawEventsTable: React.FC<RawEventsTableProps> = ({ events }) => {
    return (
        <TableContainer>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell width={60}>Task</TableCell>
                        <TableCell width={120}>Timestamp</TableCell>
                        <TableCell width={180}>Type</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell width={120}>Expand</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {events.map((event, index) => (
                        <RawEventRow key={index} event={event} />
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    )
}
