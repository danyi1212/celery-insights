import WorkerStatusList from "@components/layout/menu/WorkerStatusList"
import ApiIcon from "@mui/icons-material/Api"
import InboxIcon from "@mui/icons-material/Inbox"
import ManageSearchIcon from "@mui/icons-material/ManageSearch"
import SubjectIcon from "@mui/icons-material/Subject"
import Box from "@mui/material/Box"
import Drawer from "@mui/material/Drawer"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import { styled } from "@mui/material/styles"
import React from "react"
import { Link, useLocation } from "react-router-dom"

export const DRAWER_WIDTH = 240

const StyledDrawer = styled(Drawer)({
    width: DRAWER_WIDTH,
    flexShrink: 0,
    "& .MuiDrawer-paper": {
        width: DRAWER_WIDTH,
        boxSizing: "border-box",
    },
})

const StyledLogoContainer = styled(Link)({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "20px",
    textDecoration: "none",
})

const StyledLogo = styled(Box)({
    width: "70px",
    height: "70px",
    backgroundColor: "white",
    borderRadius: "10px",
})

interface MenuLink {
    label: string
    icon: React.ReactElement
    to: string
    external: boolean
}

const menuLinks: MenuLink[] = [
    {
        label: "Home",
        icon: <InboxIcon />,
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
        label: "API Explorer",
        icon: <ApiIcon />,
        to: "/docs",
        external: true,
    },
    {
        label: "API Docs",
        icon: <SubjectIcon />,
        to: "/redoc",
        external: true,
    },
]

const Menu: React.FC = () => {
    const location = useLocation()
    return (
        <StyledDrawer variant="permanent">
            <StyledLogoContainer to="/">
                <StyledLogo />
            </StyledLogoContainer>
            <List sx={{ flexGrow: 1 }}>
                {menuLinks.map((link, index) => (
                    <ListItem key={index} disablePadding>
                        <ListItemButton
                            selected={link.to === location.pathname}
                            component={link.external ? "a" : Link}
                            to={link.to}
                        >
                            <ListItemIcon>{link.icon}</ListItemIcon>
                            <ListItemText primary={link.label} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
            <WorkerStatusList />
        </StyledDrawer>
    )
}

export default Menu
