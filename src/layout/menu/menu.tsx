import { Sidebar, SidebarContent, SidebarHeader, SidebarRail, useSidebar } from "@components/ui/sidebar"
import DocumentationNavigationView from "@layout/menu/documentation-navigation-view"
import MainNavigationView from "@layout/menu/main-navigation-view"
import NavigationPanel from "@layout/menu/navigation-panel"
import SidebarLogo from "@layout/menu/sidebar-logo"
import { useLocation } from "@tanstack/react-router"
import React from "react"
const Menu: React.FC = () => {
  const { state } = useSidebar()
  const expanded = state === "expanded"
  const location = useLocation()
  const isDocumentationRoute = location.pathname.startsWith("/documentation")

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/60 p-0">
        <SidebarLogo />
      </SidebarHeader>
      <SidebarContent className="gap-0 overflow-hidden">
        <div className="relative min-h-0 flex-1">
          <NavigationPanel active={!isDocumentationRoute} inactivePosition="left">
            <MainNavigationView expanded={expanded} />
          </NavigationPanel>
          <NavigationPanel active={isDocumentationRoute} inactivePosition="right">
            <DocumentationNavigationView expanded={expanded} />
          </NavigationPanel>
        </div>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

export default Menu
