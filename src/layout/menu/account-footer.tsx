import { useRef, useState } from "react"
import { LogOut, Loader2, UserRound, RotateCw } from "lucide-react"
import { SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@components/ui/sidebar"
import { useIdentity } from "@hooks/use-identity"
import { authenticatedFetch } from "@lib/authenticated-fetch"
import { appUrl } from "@lib/app-url"
import useSettingsStore from "@stores/use-settings-store"

export default function AccountFooter() {
  const isDemo = useSettingsStore((state) => state.demo)
  const { data: identity, isError, refetch } = useIdentity(true)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState("")
  const pending = useRef(false)

  if (isDemo) return null

  const signOut = async () => {
    if (pending.current) return
    pending.current = true
    setSigningOut(true)
    setError("")
    try {
      const response = await authenticatedFetch(appUrl("/api/auth/logout"), { method: "POST" })
      if (!response.ok) throw new Error("Sign-out failed")
      window.location.assign(appUrl("/login") + "?reason=signed-out")
    } catch {
      setError("Could not sign out. Please try again.")
      pending.current = false
      setSigningOut(false)
    }
  }

  return (
    <SidebarFooter className="border-t border-sidebar-border/60" aria-label="Account">
      <div className="flex min-w-0 items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:hidden">
        <UserRound className="size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={identity?.display_name}>
            {identity?.display_name ?? (isError ? "Account unavailable" : "Loading account…")}
          </p>
          <p className="text-xs text-sidebar-foreground/65">
            {identity ? (identity.authentication_mode === "oidc" ? "Organization sign-in" : "Password sign-in") : ""}
          </p>
        </div>
      </div>
      <SidebarMenu>
        {isError && (
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => void refetch()}
              tooltip="Retry account details"
              aria-label="Retry account details"
            >
              <RotateCw aria-hidden="true" />
              <span>Retry account details</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => void signOut()}
            disabled={signingOut}
            tooltip={error || "Sign out"}
            aria-label={signingOut ? "Signing out…" : "Sign out"}
          >
            {signingOut ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
            <span>{signingOut ? "Signing out…" : "Sign out"}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      {error && (
        <p role="alert" className="px-2 text-xs text-destructive group-data-[collapsible=icon]:sr-only">
          {error}
        </p>
      )}
    </SidebarFooter>
  )
}
