import WorkerQuickStatusList from "@components/worker/WorkerQuickStatusList"
import MenuItem, { MenuLink } from "@layout/menu/MenuItem"
import ArrowBackIosIcon from "@mui/icons-material/ArrowBackIos"
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos"
import ManageSearchIcon from "@mui/icons-material/ManageSearch"
import RssFeedIcon from "@mui/icons-material/RssFeed"
import SettingsIcon from "@mui/icons-material/Settings"
import SpaceDashboardOutlinedIcon from "@mui/icons-material/SpaceDashboardOutlined"
import { useMediaQuery, useTheme } from "@mui/material"
import Collapse from "@mui/material/Collapse"
import Divider from "@mui/material/Divider"
import Drawer from "@mui/material/Drawer"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemButton from "@mui/material/ListItemButton"
import { styled } from "@mui/material/styles"
import Tooltip from "@mui/material/Tooltip"
import useSettingsStore from "@stores/useSettingsStore"
import React, { useEffect } from "react"
import { Link } from "react-router-dom"

export const DRAWER_WIDTH = 240
export const DRAWER_WIDTH_COLLAPSED = 72

const StyledDrawer = styled(Drawer, { shouldForwardProp: (prop) => prop !== "open" })(({ theme, open }) => ({
    backgroundColor: theme.palette.background.paper,
    "& .MuiDrawer-paper": {
        position: "fixed",
        whiteSpace: "nowrap",
        width: DRAWER_WIDTH,
        transition: theme.transitions.create("width"),
        boxSizing: "border-box",
        ...(!open && {
            overflowX: "hidden",
            transition: theme.transitions.create("width"),
            width: DRAWER_WIDTH_COLLAPSED,
        }),
    },
}))

const StyledLogoContainer = styled(Link)({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "20px",
    textDecoration: "none",
    background: "transparent",
})

const menuLinks: MenuLink[] = [
    {
        label: "Dashboard",
        icon: <SpaceDashboardOutlinedIcon />,
        to: "/",
        external: false,
    },
    {
        label: "Tasks Explorer",
        icon: <ManageSearchIcon />,
        to: "/explorer",
        external: false,
    },
    {
        label: "Live Events",
        icon: <RssFeedIcon />,
        to: "/raw_events",
        external: false,
    },
]

const Menu: React.FC = () => {
    const expanded = useSettingsStore((state) => state.menuExpanded)
    const theme = useTheme()
    const smallScreen = useMediaQuery(theme.breakpoints.down("sm"))

    useEffect(() => {
        if (smallScreen) useSettingsStore.setState({ menuExpanded: false })
    }, [smallScreen])

    return (
        <StyledDrawer variant="permanent" open={expanded}>
            <StyledLogoContainer to="/">
                <img
                    src={
                        theme.palette.mode === "dark"
                            ? expanded
                                ? "/LogoTextGreen.svg"
                                : "/LogoGreen.svg"
                            : expanded
                              ? "/LogoTextDark.svg"
                              : "/LogoDark.svg"
                    }
                    alt="logo"
                    style={{
                        width: expanded ? "128px" : "32px",
                        height: "auto",
                        transition: theme.transitions.create("width"),
                    }}
                />
            </StyledLogoContainer>
            <List component="nav" sx={{ flexGrow: 1 }}>
                {menuLinks.map((link, index) => (
                    <MenuItem key={index} link={link} expanded={expanded} />
                ))}
            </List>
            <Collapse in={expanded} unmountOnExit>
                <WorkerQuickStatusList />
            </Collapse>
            <Divider />
            <MenuItem
                link={{
                    label: "Settings",
                    icon: <SettingsIcon />,
                    to: "/settings",
                    external: false,
                }}
                expanded={expanded}
            />
            <Divider />
            <ListItem disablePadding>
                <Tooltip title={expanded ? "Collapse menu" : "Expand menu"} placement="right" arrow>
                    <ListItemButton
                        onClick={() => useSettingsStore.setState({ menuExpanded: !expanded })}
                        sx={{ display: "flex", justifyContent: expanded ? "flex-end" : "center" }}
                    >
                        {expanded ? <ArrowBackIosIcon /> : <ArrowForwardIosIcon />}
                    </ListItemButton>
                </Tooltip>
            </ListItem>
        </StyledDrawer>
    )
}

export default Menu
