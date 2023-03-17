import CeleryStateSync from "@components/CeleryStateSync"
import Header from "@layout/Header"
import Menu from "@layout/Menu"
import Box from "@mui/material/Box"
import Container from "@mui/material/Container"
import CssBaseline from "@mui/material/CssBaseline"
import { ThemeProvider } from "@mui/material/styles"
import Toolbar from "@mui/material/Toolbar"
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
                    <Header />
                    <Toolbar />
                    <Container maxWidth="lg">
                        <Outlet />
                    </Container>
                </Box>
            </Box>
        </ThemeProvider>
    )
}

export default RootLayout
