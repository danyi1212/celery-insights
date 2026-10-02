const host = process.env.E2E_HOST ?? "127.0.0.1"
export const urlPrefix = (process.env.URL_PREFIX ?? "").replace(/^\/+|\/+$/g, "")
const port = urlPrefix ? (process.env.E2E_PROXY_PORT ?? "8558") : (process.env.E2E_APP_PORT ?? "8555")
export const appOrigin = `http://${host}:${port}`
export const appPath = (pathname: string): string => `${urlPrefix ? `/${urlPrefix}` : ""}${pathname}`
export const appBaseURL = `${appOrigin}${appPath("/")}`
export const appURL = (pathname: string): string => `${appOrigin}${appPath(pathname)}`
