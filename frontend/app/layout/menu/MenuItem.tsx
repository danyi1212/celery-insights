import ListItem from "@mui/material/ListItem"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import Tooltip from "@mui/material/Tooltip"
import React from "react"
import { Link, useLocation } from "@tanstack/react-router"

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

    const buttonContent = (
        <>
            <ListItemIcon sx={{ justifyContent: "center" }}>{link.icon}</ListItemIcon>
            <ListItemText primary={link.label} sx={{ opacity: expanded ? 1 : 0 }} />
        </>
    )

    if (link.external) {
        return (
            <ListItem disablePadding sx={{ display: "block" }}>
                <Tooltip title={link.label} placement="right" disableHoverListener={expanded} arrow describeChild>
                    <ListItemButton
                        selected={link.to === location.pathname}
                        component="a"
                        href={link.to}
                        disabled={Boolean(import.meta.env.VITE_DEMO_MODE)}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ justifyContent: expanded ? "initial" : "center" }}
                    >
                        {buttonContent}
                    </ListItemButton>
                </Tooltip>
            </ListItem>
        )
    }

    return (
        <ListItem disablePadding sx={{ display: "block" }}>
            <Tooltip title={link.label} placement="right" disableHoverListener={expanded} arrow describeChild>
                <ListItemButton
                    selected={link.to === location.pathname}
                    component={Link}
                    to={link.to}
                    sx={{ justifyContent: expanded ? "initial" : "center" }}
                >
                    {buttonContent}
                </ListItemButton>
            </Tooltip>
        </ListItem>
    )
}

export default MenuItem
