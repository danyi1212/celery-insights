import TaskAvatar from "@components/task/task-avatar"
import { StateTask } from "@utils/translate-server-models"
import React from "react"
import { Handle, type Node, type NodeProps, Position } from "@xyflow/react"

type TaskNodeType = Node<StateTask, "taskNode">

const TaskNode: React.FC<NodeProps<TaskNodeType>> = ({ data }) => {
    return (
        <>
            <Handle type="target" position={Position.Left} />
            <div className="animate-in zoom-in-75 fade-in duration-300">
                <TaskAvatar taskId={data.id} type={data.type} status={data.state} className="size-[60px]" />
            </div>
            <Handle type="source" position={Position.Right} />
        </>
    )
}

export default TaskNode
