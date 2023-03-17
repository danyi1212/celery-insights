import ApiIcon from "@mui/icons-material/Api"
import InboxIcon from "@mui/icons-material/Inbox"
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
import { NavigateFunction, useLocation, useNavigate } from "react-router-dom"

const DRAWER_WIDTH = 240

const StyledDrawer = styled(Drawer)({
    width: DRAWER_WIDTH,
    flexShrink: 0,
    "& .MuiDrawer-paper": {
        width: DRAWER_WIDTH,
        boxSizing: "border-box",
    },
})

const StyledLogoContainer = styled(Box)({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "20px",
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
    isSelected: (path: string) => boolean
    onClick: (navigate: NavigateFunction) => void
}

const menuLinks: MenuLink[] = [
    {
        label: "Home",
        icon: <InboxIcon />,
        onClick: (navigate) => navigate("/"),
        isSelected: (path) => path === "/",
    },
    {
        label: "API Explorer",
        icon: <ApiIcon />,
        onClick: () => (window.location.href = "/docs"),
        isSelected: () => false,
    },
    {
        label: "API Docs",
        icon: <SubjectIcon />,
        onClick: () => (window.location.href = "/redoc"),
        isSelected: () => false,
    },
]

const Menu: React.FC = () => {
    const navigate = useNavigate()
    const location = useLocation()
    return (
        <StyledDrawer variant="permanent">
            <StyledLogoContainer>
                <StyledLogo />
            </StyledLogoContainer>
            <List>
                {menuLinks.map((link, index) => (
                    <ListItem key={index} disablePadding>
                        <ListItemButton
                            selected={link.isSelected(location.pathname)}
                            onClick={() => link.onClick(navigate)}
                        >
                            <ListItemIcon>{link.icon}</ListItemIcon>
                            <ListItemText primary={link.label} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </StyledDrawer>
    )
}

export default Menu
