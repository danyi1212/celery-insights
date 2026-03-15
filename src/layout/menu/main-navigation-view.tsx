import WorkerQuickStatusList from "@components/worker/worker-quick-status-list"
import { SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarSeparator } from "@components/ui/sidebar"
import MenuItem from "@layout/menu/menu-item"
import { docsEntryLink, mainNavigationLinks, settingsLink } from "@layout/menu/navigation-data"
import React from "react"

interface MainNavigationViewProps {
  expanded: boolean
}

const MainNavigationView: React.FC<MainNavigationViewProps> = ({ expanded }) => {
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SidebarGroup className="pt-3">
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavigationLinks.map((link) => (
                <MenuItem key={link.to} link={link} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </div>

      {expanded ? (
        <div className="px-2 pb-2">
          <section className="rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/20">
            <div className="border-b border-sidebar-border/60 px-3 py-3">
              <h2 className="text-sm font-semibold text-sidebar-foreground">Worker Status</h2>
            </div>
            <div className="max-h-[28vh] overflow-y-auto px-2 py-2">
              <WorkerQuickStatusList />
            </div>
          </section>
        </div>
      ) : null}

      <SidebarSeparator />

      <SidebarGroup className="pt-2">
        <SidebarGroupContent>
          <SidebarMenu>
            <MenuItem link={docsEntryLink} />
            <MenuItem link={settingsLink} />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </div>
  )
}

export default MainNavigationView
