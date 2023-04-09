import { PaperProps, TypographyProps } from "@mui/material"
import Paper from "@mui/material/Paper"
import Stack from "@mui/material/Stack"
import Toolbar from "@mui/material/Toolbar"
import Typography from "@mui/material/Typography"
import React from "react"

interface PanelProps extends PaperProps {
    title: string
    titleProps?: TypographyProps
    actions?: React.ReactNode
    children?: React.ReactNode
}

const Panel: React.FC<PanelProps> = ({ title, children, actions, titleProps, ...props }) => {
    return (
        <Stack direction="column" height="100%">
            <Toolbar>
                <Typography variant="h4" {...titleProps} noWrap flexGrow={1}>
                    {title}
                </Typography>
                {actions}
            </Toolbar>
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
