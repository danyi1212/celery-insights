import TaskAvatar from "@components/task/TaskAvatar"
import Zoom from "@mui/material/Zoom"
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
