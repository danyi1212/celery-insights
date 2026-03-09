import { ConnectionStatusIndicator } from "@components/connection-status"
import { appShortcuts } from "@components/keyboard/shortcut-definitions"
import { ShortcutHint } from "@components/keyboard/shortcut-hint"
import { KeyboardShortcutsButton } from "@components/keyboard/keyboard-shortcuts-button"
import SearchBox from "@components/search/search-box"
import { Button } from "@components/ui/button"
import { SidebarTrigger } from "@components/ui/sidebar"
import { Separator } from "@components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import NotificationBadge from "@layout/header/notification-badge"
import ThemeSelector from "@layout/header/theme-selector"
import { Github } from "lucide-react"
import React, { useEffect, useRef, useState } from "react"

const Header: React.FC = () => {
    const [visible, setVisible] = useState(true)
    const lastScrollYRef = useRef(0)

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY
            setVisible(currentScrollY <= 0 || currentScrollY < lastScrollYRef.current)
            lastScrollYRef.current = currentScrollY
        }
        window.addEventListener("scroll", handleScroll, { passive: true })
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    return (
        <header
            className="sticky top-0 z-40 flex items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 h-14 transition-transform duration-300"
            style={{ transform: visible ? "translateY(0)" : "translateY(-100%)" }}
        >
            <Tooltip>
                <TooltipTrigger asChild>
                    <SidebarTrigger />
                </TooltipTrigger>
                <TooltipContent>
                    <div className="flex items-center gap-2">
                        <span>Toggle sidebar</span>
                        <ShortcutHint sequence={appShortcuts.toggleSidebar} />
                    </div>
                </TooltipContent>
            </Tooltip>
            <Separator orientation="vertical" className="h-4" />
            <SearchBox />
            <div className="flex-1" />
            <div className="flex items-center gap-1">
                <ConnectionStatusIndicator />
                <KeyboardShortcutsButton />
                <Button variant="ghost" size="icon" asChild>
                    <a href="https://github.com/danyi1212/celery-insights" target="_blank" rel="noopener noreferrer">
                        <Github className="size-5" />
                    </a>
                </Button>
                <NotificationBadge />
            </div>
            <ThemeSelector />
        </header>
    )
}
export default Header
