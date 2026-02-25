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
import { LayoutDashboard, Rss, Search, Settings } from "lucide-react"
import { useIsDark } from "@hooks/use-is-dark"
import { Link } from "@tanstack/react-router"
import React from "react"

const menuLinks: MenuLink[] = [
    {
        label: "Dashboard",
        icon: <LayoutDashboard />,
        to: "/",
        external: false,
    },
    {
        label: "Tasks Explorer",
        icon: <Search />,
        to: "/explorer",
        external: false,
    },
    {
        label: "Live Events",
        icon: <Rss />,
        to: "/raw_events",
        external: false,
    },
]

const SidebarLogo: React.FC = () => {
    const { state } = useSidebar()
    const expanded = state === "expanded"
    const isDark = useIsDark()

    return (
        <Link to="/" className="flex items-center justify-center p-5 no-underline bg-transparent">
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
                className="h-auto transition-[width] duration-200"
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
                    <MenuItem
                        link={{
                            label: "Settings",
                            icon: <Settings />,
                            to: "/settings",
                            external: false,
                        }}
                    />
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}

export default Menu
