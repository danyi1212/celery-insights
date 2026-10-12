/** Preserve backend failure semantics through the server-side WebSocket proxy. */
export function forwardBackendClosure(
  backend: Pick<WebSocket, "onclose" | "onerror">,
  client: { close(code?: number, reason?: string): void },
): void {
  backend.onclose = (event) => {
    // Synthetic abnormal/no-status codes cannot appear in a wire close frame.
    const code = event.code
    const sendable =
      Number.isInteger(code) &&
      ((code >= 1000 && code <= 1014 && ![1004, 1005, 1006].includes(code)) || (code >= 3000 && code <= 4999))
    client.close(sendable ? code : 1011, sendable ? event.reason : "Database connection closed unexpectedly")
  }
  backend.onerror = () => client.close(1011, "Database connection failed")
}
