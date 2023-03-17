import CeleryStateSync from "@components/CeleryStateSync"
import Menu from "@layout/Menu"
import { Container } from "@mui/material"
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
            <Box display="flex">
                <Menu />
                <Box
                    component="main"
                    flexGrow="1"
                    minHeight="100vh"
                    overflow="auto"
                >
                    <Typography variant="h1" align="center">
                        Celery Soup
                    </Typography>
                    <Container maxWidth="lg">
                        <Outlet />
                    </Container>
                </Box>
            </Box>
        </ThemeProvider>
    )
}

export default RootLayout
