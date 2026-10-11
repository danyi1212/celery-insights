import { useEffect } from "react"
import { authenticatedFetch } from "@lib/authenticated-fetch"
import { appUrl } from "@lib/app-url"

/** The account footer unmounts during reconnects; expiry must still return users to sign-in. */
export function useSessionRecheck(connected: boolean) {
  useEffect(() => {
    if (connected) return
    const check = () => {
      void authenticatedFetch(appUrl("/api/auth/identity")).catch(() => {})
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") check()
    }
    const timer = window.setInterval(check, 60000)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [connected])
}
