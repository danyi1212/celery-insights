/** Browser credentials stay in the HTTP Basic cache; the custom header prevents cross-site writes. */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers)
  if (!["GET", "HEAD"].includes((options.method ?? "GET").toUpperCase())) headers.set("X-Celery-Insights-Request", "1")
  return fetch(url, { ...options, headers, credentials: "same-origin" })
}
