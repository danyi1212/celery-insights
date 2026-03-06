import DetailItem from "@components/common/detail-item"
import Panel from "@components/common/panel"
import { useTask } from "@hooks/use-live-tasks"
import React from "react"
import { Link } from "@tanstack/react-router"

interface DeliveryInfoPanelProps {
    taskId: string
}

const DeliveryInfoPanel: React.FC<DeliveryInfoPanelProps> = ({ taskId }) => {
    const { task, isLoading, error } = useTask(taskId)
    return (
        <Panel title="Delivery Info" loading={isLoading} error={error}>
            <div className="grid grid-cols-1 gap-2 p-2 md:grid-cols-2">
                <div className="md:col-span-2">
                    <DetailItem
                        label="Worker"
                        description="Worker that consumed this task"
                        value={
                            <Link
                                to={`/workers/${task?.worker}` as string}
                                className="text-primary underline hover:opacity-80"
                            >
                                {task?.worker || "Unknown"}
                            </Link>
                        }
                    />
                </div>
                <DetailItem
                    label="Exchange"
                    value={task?.exchange || "---"}
                    description="Name of the exchange this task was sent to"
                />
                <DetailItem
                    label="Routing Key"
                    description="Routing key this task was sent with"
                    value={task?.routing_key || "---"}
                />
            </div>
        </Panel>
    )
}
export default DeliveryInfoPanel
