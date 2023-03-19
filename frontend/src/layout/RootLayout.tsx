import ConsolidatedProviders from "@layout/ConsolidatedProviders"
import Header from "@layout/Header"
import Menu from "@layout/Menu"
import Box from "@mui/material/Box"
import Container from "@mui/material/Container"
import Toolbar from "@mui/material/Toolbar"
import React from "react"
import { Outlet } from "react-router-dom"

const RootLayout: React.FC = () => {
    return (
        <ConsolidatedProviders>
            <Box display="flex">
                <Menu />
                <Box component="main" flexGrow="1" minHeight="100vh" overflow="auto">
                    <Header />
                    <Toolbar />
                    <Container maxWidth="xl">
                        <Outlet />
                    </Container>
                </Box>
            </Box>
        </ConsolidatedProviders>
    )
}

export default RootLayout
