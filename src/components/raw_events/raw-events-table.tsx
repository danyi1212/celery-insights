import { RawEventRow } from "@components/raw_events/raw-event-row"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@components/ui/table"
import type { SurrealEvent } from "@/types/surreal-records"
import React from "react"

interface RawEventsTableProps {
  events: SurrealEvent[]
}

export const RawEventsTable: React.FC<RawEventsTableProps> = ({ events }) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[60px]">Task</TableHead>
          <TableHead className="w-[120px]">Timestamp</TableHead>
          <TableHead className="w-[180px]">Type</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="w-[120px]">Expand</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event, index) => (
          <RawEventRow key={index} event={event} />
        ))}
      </TableBody>
    </Table>
  )
}
