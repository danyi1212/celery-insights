import Header from "@layout/header/Header"
import Menu, { DRAWER_WIDTH, DRAWER_WIDTH_COLLAPSED } from "@layout/menu/Menu"
import ConsolidatedProviders from "@layout/ConsolidatedProviders"
import Box from "@mui/material/Box"
import useSettings from "@stores/useSettingsStore"
import React from "react"
import { Outlet } from "react-router-dom"

const RootLayout: React.FC = () => {
    const menuExpanded = useSettings((state) => state.menuExpanded)

    return (
        <ConsolidatedProviders>
            <Box display="flex">
                <Menu />
                <Box
                    component="main"
                    flexGrow="1"
                    minHeight="100vh"
                    sx={{
                        marginLeft: menuExpanded ? `${DRAWER_WIDTH}px` : `${DRAWER_WIDTH_COLLAPSED}px`,
                        transition: (theme) => theme.transitions.create(["margin"]),
                    }}
                >
                    <Header />
                    <Box pt={(theme) => theme.spacing(8)} height="100%" m={0}>
                        <Outlet />
                    </Box>
                </Box>
            </Box>
        </ConsolidatedProviders>
    )
}

export default RootLayout
