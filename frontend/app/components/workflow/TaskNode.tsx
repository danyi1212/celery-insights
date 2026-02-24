import TaskAvatar from "@components/task/TaskAvatar"
import Zoom from "@mui/material/Zoom"
import { StateTask } from "@utils/translateServerModels"
import React from "react"
import { Handle, type Node, type NodeProps, Position } from "@xyflow/react"

type TaskNodeType = Node<StateTask, "taskNode">

const TaskNode: React.FC<NodeProps<TaskNodeType>> = ({ data }) => {
    return (
        <>
            <Handle type="target" position={Position.Left} />
            <Zoom in>
                <div>
                    <TaskAvatar taskId={data.id} type={data.type} status={data.state} sx={{ width: 60, height: 60 }} />
                </div>
            </Zoom>
            <Handle type="source" position={Position.Right} />
        </>
    )
}

export default TaskNode
