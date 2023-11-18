export const toWebSocketUri = (path: string): string => {
    const location = window.location
    const protocol = location.protocol === "https:" ? "wss:" : "ws:"
    return `${protocol}//${location.host}/${path}`
}
