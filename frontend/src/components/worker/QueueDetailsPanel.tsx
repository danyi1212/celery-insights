import DetailItem from "@components/common/DetailItem"
import Panel from "@components/common/Panel"
import { QueueInfo } from "@services/server"
import React from "react"

interface QueueDetailsPanelProps {
    queue: QueueInfo
}

const QueueDetailsPanel: React.FC<QueueDetailsPanelProps> = ({ queue }) => {
    return (
        <Panel title={queue.name} sx={{ px: 2 }} elevation={10}>
            <DetailItem label="Exchange" value={queue.exchange.name} />
            <DetailItem label="Routing Key" value={queue.routing_key} />
            <DetailItem label="Durable" value={queue.durable.toString()} />
            <DetailItem label="Exclusive" value={queue.exclusive.toString()} />
            <DetailItem label="Auto Delete" value={queue.auto_delete.toString()} />
            <DetailItem label="No Ack" value={queue.no_ack.toString()} />
        </Panel>
    )
}
export default QueueDetailsPanel
