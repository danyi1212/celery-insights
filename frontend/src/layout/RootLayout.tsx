import Header from "@components/layout/header/Header"
import Menu from "@components/layout/menu/Menu"
import ConsolidatedProviders from "@layout/ConsolidatedProviders"
import Box from "@mui/material/Box"
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
                    <Outlet />
                </Box>
            </Box>
        </ConsolidatedProviders>
    )
}

export default RootLayout
