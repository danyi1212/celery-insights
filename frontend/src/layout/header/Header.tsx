import WsStateIcon from "@components/common/WsStateIcon"
import SearchBox from "@components/search/SearchBox"
import NotificationBadge from "@layout/header/NotificationBadge"
import ThemeSelector from "@layout/header/ThemeSelector"
import { DRAWER_WIDTH, DRAWER_WIDTH_COLLAPSED } from "@layout/menu/Menu"
import GitHubIcon from "@mui/icons-material/GitHub"
import AppBar from "@mui/material/AppBar"
import Box from "@mui/material/Box"
import IconButton from "@mui/material/IconButton"
import Slide from "@mui/material/Slide"
import Stack from "@mui/material/Stack"
import Toolbar from "@mui/material/Toolbar"
import useScrollTrigger from "@mui/material/useScrollTrigger"
import useSettingsStore from "@stores/useSettingsStore"
import useSettings from "@stores/useSettingsStore"
import { useStateStore } from "@stores/useStateStore"
import React from "react"

const StateWsStatusIcon: React.FC = () => {
    const isDemo = useSettingsStore((state) => state.demo)
    const status = useStateStore((store) => store.status)
    return <WsStateIcon state={status} isDemo={isDemo} />
}

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
                    <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                        <StateWsStatusIcon />
                        <IconButton
                            component="a"
                            href=" https://github.com/danyi1212/celery-insights"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <GitHubIcon />
                        </IconButton>
                        <NotificationBadge />
                    </Stack>
                    <ThemeSelector />
                </Toolbar>
            </AppBar>
        </Slide>
    )
}
export default Header
