import WorkerQuickStatusList from "@components/worker/worker-quick-status-list"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarRail,
    SidebarSeparator,
    useSidebar,
} from "@components/ui/sidebar"
import MenuItem, { MenuLink } from "@layout/menu/menu-item"
import { appLocations } from "@layout/navigation-links"
import { useIsDark } from "@hooks/use-is-dark"
import { Link } from "@tanstack/react-router"
import React from "react"
import { cn } from "@lib/utils"

const menuLinks: MenuLink[] = appLocations
    .filter((location) => location.sidebar)
    .map(({ icon: Icon, label, to }) => ({
        label,
        icon: <Icon />,
        to,
        external: false,
    }))

const settingsLocation = appLocations.find((location) => location.to === "/settings")

if (!settingsLocation) {
    throw new Error("Settings location is missing from navigation definitions")
}

const SettingsIcon = settingsLocation.icon

const settingsLink: MenuLink = {
    label: settingsLocation.label,
    icon: <SettingsIcon />,
    to: settingsLocation.to,
    external: false,
}

const SidebarLogo: React.FC = () => {
    const { state } = useSidebar()
    const expanded = state === "expanded"
    const isDark = useIsDark()

    return (
        <Link
            to="/"
            className={cn("flex items-center justify-center no-underline bg-transparent", expanded ? "p-5" : "p-1")}
        >
            <img
                src={
                    isDark
                        ? expanded
                            ? "/LogoTextGreen.svg"
                            : "/LogoGreen.svg"
                        : expanded
                          ? "/LogoTextDark.svg"
                          : "/LogoDark.svg"
                }
                alt="logo"
                className="h-auto shrink-0 transition-[width] duration-200"
                style={{ width: expanded ? "128px" : "32px" }}
            />
        </Link>
    )
}

const Menu: React.FC = () => {
    const { state } = useSidebar()
    const expanded = state === "expanded"

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <SidebarLogo />
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {menuLinks.map((link, index) => (
                                <MenuItem key={index} link={link} />
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                {expanded && (
                    <SidebarGroup>
                        <SidebarGroupLabel>Workers</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <WorkerQuickStatusList />
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
            </SidebarContent>
            <SidebarFooter>
                <SidebarSeparator />
                <SidebarMenu>
                    <MenuItem link={settingsLink} />
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}

export default Menu
