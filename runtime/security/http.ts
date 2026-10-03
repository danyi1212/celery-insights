import { Authorization, type PolicyContext } from "./opa"
import { timingSafeEqual } from "node:crypto"
import type { AuthenticationSnapshot } from "../authentication-config"
import { AuthError, grants, payloadPermissions, routePermissions, type Principal } from "./permissions"

export const requestHeader = "X-Celery-Insights-Request"
export const noStore = (response: Response): Response => {
  const headers = new Headers(response.headers)
  headers.set("Cache-Control", "no-store")
  headers.set("Content-Security-Policy", "frame-ancestors 'none'")
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}
export function authFailure(error: unknown): Response {
  const status = error instanceof AuthError ? error.status : 503
  return noStore(
    Response.json(
      { detail: error instanceof AuthError ? error.message : "Authentication unavailable" },
      {
        status,
        headers: status === 401 ? { "WWW-Authenticate": 'Basic realm="Celery Insights", charset="UTF-8"' } : {},
      },
    ),
  )
}

/** Every application request crosses the same Bun authorization gate. */
export async function secureApplicationRequest(
  request: Request,
  prefix: string,
  auth: AuthenticationHttp | null,
  replay: boolean,
  dispatch: () => Promise<Response | undefined>,
): Promise<Response | undefined> {
  const pathname = new URL(request.url).pathname
  if (prefix && pathname !== prefix && pathname !== "/health" && !pathname.startsWith(prefix + "/")) return dispatch()
  const normalized = pathname === "/health" ? pathname : pathname.slice(prefix.length)
  if (normalized === "/health" || /^\/(assets\/|favicon\.|robots\.txt$)/.test(normalized)) return dispatch()
  try {
    if (!auth) throw new AuthError(503, "Authentication unavailable")
    const origin = request.headers.get("origin")
    if (
      (origin !== null && origin !== auth.origin) ||
      (request.headers.get("sec-fetch-site") === "cross-site" && request.headers.get("sec-fetch-mode") !== "navigate")
    )
      throw new AuthError(403, "Request origin denied")
    if (normalized === "/api/auth/identity" && request.method === "GET") {
      const principal = auth.principal(request)
      await auth.authorization.check(
        principal,
        [],
        { method: request.method, path: normalized, transport: "http" },
        replay,
      )
      return noStore(Response.json({ account_id: principal.account_id, permissions: [...grants(principal)].sort() }))
    }
    if (/^\/(api(?:\/|$)|metrics(?:\/|$)|surreal(?:\/|$)|mcp(?:\/|$)|ws(?:\/|$))/.test(normalized))
      await auth.gate(request, normalized, replay)
    else
      await auth.authorization.check(
        auth.principal(request),
        [],
        { method: request.method, path: normalized, transport: "http" },
        replay,
      ) // Challenge browser navigation before loading the UI.
    const response = await dispatch()
    return response ? noStore(response) : undefined
  } catch (error) {
    return authFailure(error)
  }
}

export class AuthenticationHttp {
  readonly origin: string
  constructor(
    private readonly snapshot: AuthenticationSnapshot,
    readonly authorization = new Authorization(),
  ) {
    this.origin = snapshot.public_origin
  }

  /** No credential state, hashes or sessions: verify against startup configuration. */
  principal(request: Request): Principal {
    const header = request.headers.get("authorization") ?? ""
    if (header.length > 6000) throw new AuthError(401, "Authentication required")
    const encoded = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(header)?.[1]
    if (!encoded) throw new AuthError(401, "Authentication required")
    const bytes = Buffer.from(encoded, "base64")
    if (bytes.toString("base64") !== encoded) throw new AuthError(401, "Authentication required")
    let decoded: string
    try {
      decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    } catch {
      throw new AuthError(401, "Authentication required")
    }
    const separator = decoded.indexOf(":")
    const username = decoded.slice(0, separator)
    const supplied = Buffer.from(decoded.slice(separator + 1))
    const account = this.snapshot.accounts.find((entry) => entry.username === username)
    // Fixed-size native comparison also covers unknown users; no password hashing.
    const expected = Buffer.from(account?.password ?? "")
    const left = Buffer.alloc(4096)
    const right = Buffer.alloc(4096)
    supplied.copy(left)
    expected.copy(right)
    const matches = timingSafeEqual(left, right)
    if (!matches || !account || separator < 1 || supplied.length !== expected.length || supplied.length > 4096)
      throw new AuthError(401, "Authentication required")
    return this.accountPrincipal(account.username)!
  }

  accountPrincipal(username: string): Principal | null {
    const account = this.snapshot.accounts.find((entry) => entry.username === username)
    return account ? { account_id: account.username, roles: [...account.roles] } : null
  }

  async gate(request: Request, pathname: string, replay: boolean): Promise<Principal> {
    const principal = this.principal(request)
    const websocket = request.headers.get("upgrade")?.toLowerCase() === "websocket"
    if (websocket || !["GET", "HEAD"].includes(request.method)) {
      if (request.headers.get("origin") !== this.origin) throw new AuthError(403, "Request origin denied")
      if (!websocket && request.headers.get(requestHeader) !== "1") throw new AuthError(403, "Request header required")
    }
    let actions = routePermissions[`${request.method} ${pathname}`]
    if (pathname === "/surreal/rpc" && ["GET", "POST"].includes(request.method)) actions = payloadPermissions
    if (pathname === "/mcp") actions = payloadPermissions
    if (!actions) throw new AuthError(403, "Access denied")
    const context: PolicyContext = {
      method: request.method,
      path: pathname,
      transport: websocket ? "websocket" : "http",
    }
    await this.authorization.check(principal, actions, context, replay)
    return principal
  }
}

export function initializeAuthentication(
  snapshot: AuthenticationSnapshot,
  authorization = new Authorization(),
): AuthenticationHttp {
  return new AuthenticationHttp(snapshot, authorization)
}
