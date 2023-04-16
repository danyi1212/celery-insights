import NotificationBadge from "@components/layout/header/NotificationBadge"
import SearchBox from "@components/layout/header/SearchBox"
import ThemeSelector from "@components/layout/header/ThemeSelector"
import WSStatus from "@components/layout/header/WSStatus"
import { DRAWER_WIDTH, DRAWER_WIDTH_COLLAPSED } from "@components/layout/menu/Menu"
import AppBar from "@mui/material/AppBar"
import Box from "@mui/material/Box"
import Slide from "@mui/material/Slide"
import Toolbar from "@mui/material/Toolbar"
import useScrollTrigger from "@mui/material/useScrollTrigger"
import useSettings from "@stores/useSettingsStore"
import React from "react"

const Header: React.FC = () => {
    const trigger = useScrollTrigger({ target: window })
    const menuExpanded = useSettings((state) => state.menuExpanded)

    return (
        <Slide appear={false} direction="down" in={!trigger}>
            <AppBar color="default">
                <Toolbar
                    sx={{
                        marginLeft: menuExpanded ? `${DRAWER_WIDTH}px` : `${DRAWER_WIDTH_COLLAPSED}px`,
                        transition: (theme) => theme.transitions.create(["margin"]),
                        pr: 2,
                    }}
                    disableGutters
                >
                    <SearchBox />
                    <Box flexGrow="1" />
                    <WSStatus />
                    <NotificationBadge />
                    <ThemeSelector />
                </Toolbar>
            </AppBar>
        </Slide>
    )
}
export default Header
