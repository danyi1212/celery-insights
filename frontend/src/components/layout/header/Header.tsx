import NotificationBadge from "@components/layout/header/NotificationBadge"
import SearchBox from "@components/layout/header/SearchBox"
import WSStatus from "@components/layout/header/WSStatus"
import { DRAWER_WIDTH } from "@components/layout/menu/Menu"
import AppBar from "@mui/material/AppBar"
import Box from "@mui/material/Box"
import Slide from "@mui/material/Slide"
import Toolbar from "@mui/material/Toolbar"
import useScrollTrigger from "@mui/material/useScrollTrigger"
import React from "react"

const Header: React.FC = () => {
    const trigger = useScrollTrigger({ target: window })

    return (
        <Slide appear={false} direction="down" in={!trigger}>
            <AppBar>
                <Toolbar sx={{ ml: DRAWER_WIDTH + "px", pr: 2 }} disableGutters>
                    <SearchBox />
                    <Box flexGrow="1" />
                    <WSStatus />
                    <NotificationBadge />
                </Toolbar>
            </AppBar>
        </Slide>
    )
}
export default Header
