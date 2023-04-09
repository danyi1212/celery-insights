import { PaperProps } from "@mui/material"
import Paper from "@mui/material/Paper"
import React from "react"

interface PanelPaperProps extends PaperProps {
    children?: React.ReactNode
}

const PanelPaper: React.FC<PanelPaperProps> = ({ children, ...props }) => (
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
)

export default PanelPaper
