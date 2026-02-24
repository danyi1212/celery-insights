import { SidebarMenuButton, SidebarMenuItem as SidebarMenuItemWrapper } from "@components/ui/sidebar"
import { Link, useLocation } from "@tanstack/react-router"
import React from "react"

export interface MenuLink {
    label: string
    icon: React.ReactElement
    to: string
    external: boolean
}

interface MenuItemProps {
    link: MenuLink
    disabled?: boolean
}

const MenuItem: React.FC<MenuItemProps> = ({ link, disabled }) => {
    const location = useLocation()
    const isActive = link.to === "/" ? location.pathname === "/" : location.pathname.startsWith(link.to)

    if (link.external) {
        return (
            <SidebarMenuItemWrapper>
                <SidebarMenuButton asChild isActive={isActive} tooltip={link.label}>
                    <a
                        href={link.to}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-disabled={disabled}
                        className={disabled ? "pointer-events-none opacity-50" : undefined}
                    >
                        {link.icon}
                        <span>{link.label}</span>
                    </a>
                </SidebarMenuButton>
            </SidebarMenuItemWrapper>
        )
    }

    return (
        <SidebarMenuItemWrapper>
            <SidebarMenuButton asChild isActive={isActive} tooltip={link.label}>
                <Link to={link.to}>
                    {link.icon}
                    <span>{link.label}</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItemWrapper>
    )
}

export default MenuItem
