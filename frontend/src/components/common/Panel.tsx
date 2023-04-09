import { PaperProps } from "@mui/material"
import Paper from "@mui/material/Paper"
import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"
import React from "react"

interface PanelProps extends PaperProps {
    title: string
    children?: React.ReactNode
}

const Panel: React.FC<PanelProps> = ({ title, children, ...props }) => {
    return (
        <Stack direction="column" height="100%">
            <Typography variant="h4" p={2} mx={2} noWrap>
                {title}
            </Typography>
            <Paper
                {...props}
                sx={{
                    padding: 1,
                    borderRadius: "24px",
                    ...props.sx,
                    height: "100%",
                    overflow: "auto",
                }}
            >
                {children}
            </Paper>
        </Stack>
    )
}
export default Panel
