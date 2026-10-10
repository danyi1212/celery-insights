import { authenticatedFetch } from "@lib/authenticated-fetch"
import { appUrl } from "@lib/app-url"
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
import React, { useEffect, useRef, useState } from "react"

const Header: React.FC = () => {
  const [visible, setVisible] = useState(true)
  const lastScrollYRef = useRef(0)

  useEffect(() => {
    const check = () => {
      void authenticatedFetch(appUrl("/api/auth/identity")).catch(() => {})
    }
    const timer = window.setInterval(check, 60000)
    return () => window.clearInterval(timer)
  }, [])

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
        <Button
          variant="ghost"
          onClick={async () => {
            const response = await authenticatedFetch(appUrl("/api/auth/logout"), { method: "POST" })
            if (response.ok) window.location.assign(appUrl("/login"))
          }}
        >
          Sign out
        </Button>
        <ConnectionStatusIndicator />
        <KeyboardShortcutsButton />
        <Button variant="ghost" size="icon" asChild>
          <a
            href="https://github.com/danyi1212/celery-insights"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub repository"
          >
            <svg
              className="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
          </a>
        </Button>
        <NotificationBadge />
      </div>
      <ThemeSelector />
    </header>
  )
}
export default Header
