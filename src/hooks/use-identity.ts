import { useQuery } from "@tanstack/react-query"
import { authenticatedFetch } from "@lib/authenticated-fetch"
import { appUrl } from "@lib/app-url"
import useSettingsStore from "@stores/use-settings-store"

export interface Identity {
  account_id: string
  display_name: string
  authentication_mode: "basic" | "oidc"
  permissions: string[]
}

/** Shared identity polling also detects expired sessions and sign-out in another tab. */
export function useIdentity(poll = false) {
  const isDemo = useSettingsStore((state) => state.demo)
  return useQuery({
    queryKey: ["identity", isDemo ? "demo" : "live"],
    queryFn: async (): Promise<Identity> => {
      const response = await authenticatedFetch(appUrl("/api/auth/identity"))
      if (!response.ok) throw new Error("Unable to load your account. Please try again.")
      return response.json()
    },
    enabled: !isDemo,
    staleTime: 30000,
    refetchInterval: !isDemo && poll ? 60000 : false,
    retry: false,
  })
}
