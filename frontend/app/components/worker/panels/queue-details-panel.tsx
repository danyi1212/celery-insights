import DetailItem from "@components/common/detail-item"
import Panel from "@components/common/panel"
import { Switch } from "@components/ui/switch"
import type { QueueInfo } from "@/types/surreal-records"
import React from "react"

interface QueueDetailsPanelProps {
    queue: QueueInfo
}

const QueueDetailsPanel: React.FC<QueueDetailsPanelProps> = ({ queue }) => {
    return (
        <Panel title={queue.name || "Unknown"} className="px-2">
            {queue?.exchange?.name !== queue.routing_key ? (
                <DetailItem
                    label="Exchange"
                    description="The name of the exchange that the queue is bound to"
                    value={queue?.exchange?.name || "Unknown"}
                />
            ) : null}
            <DetailItem
                label="Routing Key"
                description="The routing key that the queue is bound to"
                value={queue.routing_key}
            />
            {queue.alias && <DetailItem label="Alias" description="An alias for the queue name" value={queue.alias} />}
            <DetailItem
                label="Durable"
                description="Whether the queue should survive broker restarts"
                value={<Switch size="sm" checked={queue.durable} />}
            />
            <DetailItem
                label="Exclusive"
                description="Whether the queue can be used by only one consumer"
                value={<Switch size="sm" checked={queue.exclusive} />}
            />
            <DetailItem
                label="No Ack"
                description="Whether task messages will not be acknowledged by workers"
                value={<Switch size="sm" checked={queue.no_ack} />}
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
