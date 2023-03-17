import { DRAWER_WIDTH } from "@layout/Menu"
import NotificationBudge from "@layout/NotificationBudge"
import SearchBox from "@layout/SearchBox"
import WSStatus from "@layout/WSStatus"
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
                    <NotificationBudge />
                </Toolbar>
            </AppBar>
        </Slide>
    )
}
export default Header
