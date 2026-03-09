import Box from "@mui/material/Box"
import React from "react"

interface KbdProps {
    children: React.ReactNode
}

const Kbd: React.FC<KbdProps> = ({ children }) => {
    return (
        <Box
            component="kbd"
            sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "1.6em",
                px: 0.75,
                py: 0.25,
                borderRadius: 1,
                border: (theme) => `1px solid ${theme.palette.divider}`,
                backgroundColor: (theme) => theme.palette.background.paper,
                boxShadow: (theme) => `inset 0 -1px 0 ${theme.palette.divider}`,
                color: "text.secondary",
                fontFamily: "monospace",
                fontSize: "0.75rem",
                fontWeight: 600,
                lineHeight: 1,
                whiteSpace: "nowrap",
            }}
        >
            {children}
        </Box>
    )
}

export default Kbd
