import TaskStatusIcon from "@components/task/TaskStatusIcon"
import Box from "@mui/material/Box"
import Link from "@mui/material/Link"
import Typography from "@mui/material/Typography"
import { StateTask } from "@utils/translateServerModels"
import React from "react"
import { Link as RouterLink } from "react-router-dom"
import { Handle, NodeProps, Position } from "reactflow"

interface WorkflowTaskNodeProps extends NodeProps {
    data: StateTask
}

const WorkflowTaskNode: React.FC<WorkflowTaskNodeProps> = ({ data }) => {
    return (
        <>
            <Handle type="target" position={Position.Left} />
            <Box
                maxWidth="250px"
                height="80px"
                p={1}
                sx={{ backgroundColor: (theme) => theme.palette.action.selected, borderRadius: 5 }}
            >
                <Typography overflow="hidden">
                    <TaskStatusIcon status={data.state} />
                    <Link component={RouterLink} to={`/tasks/${data.id}`}>
                        {data.id}
                    </Link>{" "}
                    | {data.type}
                </Typography>
            </Box>
            <Handle type="source" position={Position.Right} />
        </>
    )
}

export default WorkflowTaskNode
