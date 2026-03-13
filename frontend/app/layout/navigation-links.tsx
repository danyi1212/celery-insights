import type { LucideIcon } from "lucide-react"
import { ArrowLeftRight, BarChart3, LayoutDashboard, Rss, Search, Settings } from "lucide-react"

export type AppLocationPath = "/" | "/analytics" | "/explorer" | "/raw_events" | "/settings" | "/tasks/compare"

export interface AppLocation {
    label: string
    description: string
    icon: LucideIcon
    keywords: string[]
    sidebar: boolean
    to: AppLocationPath
}

export const appLocations: AppLocation[] = [
    {
        label: "Dashboard",
        description: "Overview, recent tasks, and online workers",
        to: "/",
        icon: LayoutDashboard,
        keywords: ["home", "overview", "recent tasks", "online workers", "summary"],
        sidebar: true,
    },
    {
        label: "Tasks Explorer",
        description: "Browse, search, and filter tasks",
        to: "/explorer",
        icon: Search,
        keywords: ["tasks", "search", "filters", "explorer", "grid"],
        sidebar: true,
    },
    {
        label: "Live Events",
        description: "Inspect the raw event stream",
        to: "/raw_events",
        icon: Rss,
        keywords: ["events", "raw events", "stream", "event types", "websocket"],
        sidebar: true,
    },
    {
        label: "Analytics",
        description: "Failure rate, throughput, and worker load charts",
        to: "/analytics",
        icon: BarChart3,
        keywords: ["metrics", "charts", "throughput", "failure rate", "worker load"],
        sidebar: true,
    },
    {
        label: "Settings",
        description: "App settings, server info, retention, backups, and debug tools",
        to: "/settings",
        icon: Settings,
        keywords: ["preferences", "server info", "retention", "backup", "debug bundle", "api docs"],
        sidebar: false,
    },
    {
        label: "Compare Tasks",
        description: "Open the side-by-side task comparison view",
        to: "/tasks/compare",
        icon: ArrowLeftRight,
        keywords: ["compare", "diff", "comparison", "task compare"],
        sidebar: false,
    },
]
