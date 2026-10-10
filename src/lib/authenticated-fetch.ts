import { appUrl } from "./app-url"

/** HttpOnly session cookies authenticate the browser; the custom header prevents cross-site writes. */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers)
  if (!["GET", "HEAD"].includes((options.method ?? "GET").toUpperCase())) headers.set("X-Celery-Insights-Request", "1")
  const response = await fetch(url, { ...options, headers, credentials: "same-origin" })
  if (response.status === 401)
    window.location.assign(
      appUrl("/login") + "?returnTo=" + encodeURIComponent(window.location.pathname + window.location.search),
    )
  return response
}
