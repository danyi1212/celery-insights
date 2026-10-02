/** Public mount path injected into the HTML by the production server. */
export const getUrlPrefix = (): string =>
  document.querySelector<HTMLMetaElement>('meta[name="url-prefix"]')?.content ?? ""

/** Use for same-origin endpoints, public assets, and plain anchor links. */
export const appUrl = (pathname: string): string => `${getUrlPrefix()}${pathname}`

/** Hash links must stay on the current page even with a document base URL. */
export const appHref = (href: string): string => {
  if (href.startsWith("#")) return `${window.location.pathname}${window.location.search}${href}`
  if (href.startsWith("/") && !href.startsWith("//")) return appUrl(href)
  return href
}
