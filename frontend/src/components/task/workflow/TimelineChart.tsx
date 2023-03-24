import Box from "@mui/material/Box"
import { StateTask } from "@utils/translateServerModels"
import React from "react"

interface TimelineChartProps {
    tasks: StateTask[]
    rootTaskId: string
    currentTaskId?: string
}

const TimelineChart: React.FC<TimelineChartProps> = ({}) => {
    return <Box bgcolor="white" height="100%"></Box>
}

export default TimelineChart
