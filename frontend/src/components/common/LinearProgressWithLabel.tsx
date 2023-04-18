import Box from "@mui/material/Box"
import LinearProgress, { LinearProgressProps } from "@mui/material/LinearProgress"
import Typography from "@mui/material/Typography"
import React, { useMemo } from "react"

interface LinearProgressWithLabelProps extends LinearProgressProps {
    value: number
    max?: number
    min?: number
    buffer?: number
    percentageLabel?: boolean
}

const LinearProgressWithLabel: React.FC<LinearProgressWithLabelProps> = ({
    value,
    max = 100,
    min = 0,
    buffer = 0,
    percentageLabel,
    ...props
}) => {
    const percentage = useMemo(() => Math.round(((value - min) * 100) / (max - min)), [value, min, max])
    const bufferPercentage = useMemo(() => Math.round(((buffer - min) * 100) / (max - min)), [buffer, min, max])
    const label = useMemo(
        () => (percentageLabel ? `${Math.round(percentage)}%` : `${value + min}/${max}`),
        [percentageLabel, percentage, min, max, value]
    )
    return (
        <Box display="flex" alignItems="center">
            <Box width="100%" mr={1}>
                <LinearProgress
                    {...props}
                    variant={buffer && percentage < bufferPercentage ? "buffer" : "determinate"}
                    value={percentage}
                    valueBuffer={bufferPercentage}
                />
            </Box>
            <Box minWidth="35">
                <Typography variant="body2" color="text.secondary">
                    {label}
                </Typography>
            </Box>
        </Box>
    )
}

export default LinearProgressWithLabel
