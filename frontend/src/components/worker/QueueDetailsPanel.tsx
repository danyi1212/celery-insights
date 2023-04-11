import DetailItem from "@components/common/DetailItem"
import Panel from "@components/common/Panel"
import Switch from "@mui/material/Switch"
import { QueueInfo } from "@services/server"
import React from "react"

interface QueueDetailsPanelProps {
    queue: QueueInfo
}

const QueueDetailsPanel: React.FC<QueueDetailsPanelProps> = ({ queue }) => {
    return (
        <Panel title={queue.name} sx={{ px: 2 }} elevation={10}>
            <DetailItem
                label="Exchange"
                description="The name of the exchange that the queue is bound to"
                value={queue.exchange.name}
            />
            <DetailItem
                label="Routing Key"
                description="The routing key that the queue is bound to"
                value={queue.routing_key}
            />
            {queue.alias && <DetailItem label="Alias" description="An alias for the queue name" value={queue.alias} />}
            <DetailItem
                label="Durable"
                description="Whether the queue should survive broker restarts"
                value={<Switch color="success" size="small" checked={queue.durable} />}
            />
            <DetailItem
                label="Exclusive"
                description="Whether the queue can be used by only one consumer"
                value={<Switch color="success" size="small" checked={queue.exclusive} />}
            />
            <DetailItem
                label="No Ack"
                description="Whether task messages will not be acknowledged by workers"
                value={<Switch color="success" size="small" checked={queue.no_ack} />}
            />
            {queue.message_ttl && (
                <DetailItem
                    label="Message TTL"
                    description="The time-to-live (in seconds) for messages in the queue"
                    value={`${queue.message_ttl} seconds`}
                />
            )}
            {queue.max_length && (
                <DetailItem
                    label="Max Length"
                    description="The maximum number of task messages allowed in the queue"
                    value={queue.max_length.toString()}
                />
            )}
        </Panel>
    )
}

export default QueueDetailsPanel
