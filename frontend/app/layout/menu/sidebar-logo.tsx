import { useIsDark } from "@hooks/use-is-dark"
import { useSidebar } from "@components/ui/sidebar"
import { Link } from "@tanstack/react-router"
import React from "react"

const SidebarLogo: React.FC = () => {
    const { state } = useSidebar()
    const expanded = state === "expanded"
    const isDark = useIsDark()

    return (
        <Link to="/" className="flex items-center justify-center bg-transparent p-5 no-underline">
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
                alt="Celery Insights"
                className="h-auto transition-[width] duration-200"
                style={{ width: expanded ? "128px" : "32px" }}
            />
        </Link>
    )
}

export default SidebarLogo
