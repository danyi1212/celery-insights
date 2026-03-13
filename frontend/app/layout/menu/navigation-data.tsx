import { helpNavigation } from "@components/documentation/help-navigation"
import type { MenuLink } from "@layout/menu/menu-item"
import { BarChart3, BookOpen, LayoutDashboard, Rss, Search, Settings } from "lucide-react"

export const mainNavigationLinks: MenuLink[] = [
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
    {
        label: "Analytics",
        icon: <BarChart3 />,
        to: "/analytics",
        external: false,
    },
]

export const docsEntryLink: MenuLink = {
    label: "Documentation",
    icon: <BookOpen />,
    to: "/documentation/setup",
    external: false,
}

export const settingsLink: MenuLink = {
    label: "Settings",
    icon: <Settings />,
    to: "/settings",
    external: false,
}

const documentationGroups = ["Getting Started", "Reference", "Operations"] as const

export const documentationNavigationGroups = documentationGroups.map((title) => ({
    title,
    pages: helpNavigation.filter((page) => page.group === title),
}))
