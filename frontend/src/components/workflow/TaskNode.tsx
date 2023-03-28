import TaskAvatar from "@components/task/TaskAvatar"
import { StateTask } from "@utils/translateServerModels"
import React from "react"
import { Handle, NodeProps, Position } from "reactflow"

interface TaskNodeProps extends NodeProps {
    data: StateTask
}

const TaskNode: React.FC<TaskNodeProps> = ({ data }) => {
    return (
        <>
            <Handle type="target" position={Position.Left} />
            <TaskAvatar taskId={data.id} type={data.type} status={data.state} sx={{ width: 60, height: 60 }} />
            <Handle type="source" position={Position.Right} />
        </>
    )
}

export default TaskNode
