import CeleryStateSync from "@components/CeleryStateSync"
import Box from "@mui/material/Box"
import CssBaseline from "@mui/material/CssBaseline"
import { ThemeProvider } from "@mui/material/styles"
import Typography from "@mui/material/Typography"
import theme from "@theme"
import React from "react"
import { Outlet } from "react-router-dom"

const RootLayout: React.FC = () => {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <CeleryStateSync />
            <Box>
                <Typography variant="h1" align="center">
                    Celery Soup
                </Typography>
                <Outlet />
            </Box>
        </ThemeProvider>
    )
}

export default RootLayout
