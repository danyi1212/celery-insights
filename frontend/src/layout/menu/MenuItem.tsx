import ListItem from "@mui/material/ListItem"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import Tooltip from "@mui/material/Tooltip"
import React from "react"
import { Link, useLocation } from "react-router-dom"

export interface MenuLink {
    label: string
    icon: React.ReactElement
    to: string
    external: boolean
}

interface MenuItemProps {
    link: MenuLink
    expanded?: boolean
}

const MenuItem: React.FC<MenuItemProps> = ({ link, expanded }) => {
    const location = useLocation()
    return (
        <ListItem disablePadding sx={{ display: "block" }}>
            <Tooltip title={link.label} placement="right" disableHoverListener={expanded} arrow describeChild>
                <ListItemButton
                    selected={link.to === location.pathname}
                    component={link.external ? "a" : Link}
                    to={link.to}
                    disabled={Boolean(import.meta.env.VITE_DEMO_MODE) && link.external}
                    target={link.external ? "_blank" : ""}
                    rel={link.external ? "noopener noreferrer" : ""}
                    sx={{
                        justifyContent: expanded ? "initial" : "center",
                    }}
                >
                    <ListItemIcon sx={{ justifyContent: "center" }}>{link.icon}</ListItemIcon>
                    <ListItemText primary={link.label} sx={{ opacity: expanded ? 1 : 0 }} />
                </ListItemButton>
            </Tooltip>
        </ListItem>
    )
}

export default MenuItem
