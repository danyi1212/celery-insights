import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@components/ui/sidebar"
import MenuItem from "@layout/menu/menu-item"
import { documentationNavigationGroups, settingsLink } from "@layout/menu/navigation-data"
import { ArrowLeft, BookOpen, FileText } from "lucide-react"
import { Link, useLocation } from "@tanstack/react-router"
import React from "react"
import { cn } from "@lib/utils"

interface DocumentationNavigationViewProps {
  expanded: boolean
}

const DocumentationNavigationView: React.FC<DocumentationNavigationViewProps> = ({ expanded }) => {
  const location = useLocation()

  return (
    <div className="flex h-full flex-col">
      <SidebarGroup className="grow">
        <SidebarGroupContent className="space-y-4">
          <div
            className={cn(
              "flex items-center justify-center gap-2 px-2 pb-3 text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/55",
              !expanded && "hidden",
            )}
          >
            <BookOpen className="size-3.5" />
            <span>Documentation</span>
          </div>

          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="Back to Dashboard"
                className={cn(
                  "h-10 rounded-xl bg-primary px-3 text-primary-foreground shadow-none hover:bg-primary/90 hover:text-primary-foreground data-[active=true]:bg-primary data-[active=true]:text-primary-foreground",
                  !expanded && "hidden",
                )}
              >
                <Link to="/">
                  <ArrowLeft />
                  <span>Back to Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>

          {documentationNavigationGroups.map((group) => (
            <section key={group.title} className="space-y-1.5">
              <div className={cn("px-2 pb-1", !expanded && "hidden")}>
                <SidebarGroupLabel className="h-auto px-0 text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/55">
                  {group.title}
                </SidebarGroupLabel>
              </div>

              <SidebarMenu className="gap-1">
                {group.pages.map((page) => (
                  <SidebarMenuItem key={page.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === page.href}
                      tooltip={page.title}
                      className="h-10 rounded-xl px-3"
                    >
                      <Link to={page.href}>
                        <FileText />
                        <span>{page.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </section>
          ))}
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarSeparator />

      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <MenuItem link={settingsLink} />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </div>
  )
}

export default DocumentationNavigationView
