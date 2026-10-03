import { Sessions } from "./sessions"
import { loginPage } from "./login-page"
import { Authorization, type PolicyContext } from "./opa"
import { timingSafeEqual } from "node:crypto"
import type { AuthenticationSnapshot } from "../authentication-config"
import { AuthError, grants, payloadPermissions, routePermissions, type Principal } from "./permissions"

export const requestHeader = "X-Celery-Insights-Request"
export const noStore = (response: Response): Response => {
  const headers = new Headers(response.headers)
  headers.set("Cache-Control", "no-store")
  if (!headers.has("Content-Security-Policy")) headers.set("Content-Security-Policy", "frame-ancestors 'none'")
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}
export function authFailure(error: unknown): Response {
  const status = error instanceof AuthError ? error.status : 503
  return noStore(
    Response.json(
      { detail: error instanceof AuthError ? error.message : "Authentication unavailable" },
      {
        status,
        headers: {},
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
    const authResponse = await auth.handle(request, normalized)
    if (authResponse) return noStore(authResponse)
    const origin = request.headers.get("origin")
    if (
      (origin !== null && origin !== auth.origin) ||
      (request.headers.get("sec-fetch-site") === "cross-site" && request.headers.get("sec-fetch-mode") !== "navigate")
    )
      throw new AuthError(403, "Request origin denied")
    await auth.authenticate(request)
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
      ) // Authenticate browser navigation before loading the UI.
    const response = await dispatch()
    return response ? noStore(response) : undefined
  } catch (error) {
    if (
      error instanceof AuthError &&
      error.status === 401 &&
      request.method === "GET" &&
      (request.headers.get("sec-fetch-mode") === "navigate" || request.headers.get("accept")?.includes("text/html"))
    )
      return noStore(
        new Response(null, {
          status: 303,
          headers: {
            Location: `${prefix}/login?returnTo=${encodeURIComponent(pathname + new URL(request.url).search)}`,
          },
        }),
      )
    return authFailure(error)
  }
}

export class AuthenticationHttp {
  readonly origin: string
  private readonly principals = new WeakMap<Request, Principal>()
  private readonly sessions?: Sessions
  constructor(private readonly snapshot: AuthenticationSnapshot, readonly authorization = new Authorization()) {
    this.origin = snapshot.public_origin
    if (snapshot.session_secret) this.sessions = new Sessions(snapshot)
  }

  async authenticate(request: Request): Promise<Principal> {
    // Browser sign-in/logout must not fall back to a previously cached Basic credential.
    if (
      this.sessions &&
      request.headers.has("sec-fetch-site") &&
      !request.headers.get("cookie")?.includes("__Secure-insights-")
    )
      throw new AuthError(401, "Sign in required")
    const principal =
      this.sessions && request.headers.get("cookie")?.includes("__Secure-insights-")
        ? await this.sessions.principal(request)
        : this.basicPrincipal(request)
    this.principals.set(request, principal)
    return principal
  }

  principal(request: Request): Principal {
    return this.principals.get(request) ?? this.basicPrincipal(request)
  }

  /** Programmatic clients may still send explicit Basic credentials; browsers use cookies. */
  private basicPrincipal(request: Request): Principal {
    if (this.snapshot.mode === "oidc") throw new AuthError(401, "Sign in required")
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

  async handle(request: Request, pathname: string): Promise<Response | undefined> {
    if (!this.sessions) return undefined
    const sessions = this.sessions
    const url = new URL(request.url)
    const mode = this.snapshot.mode ?? "basic"
    if (pathname === "/login" && request.method === "GET") {
      const error = url.searchParams.get("error")
      return loginPage(
        sessions.prefix,
        mode,
        sessions.returnPath(url.searchParams.get("returnTo")),
        error === "denied"
          ? "Your account does not have access to this installation."
          : error
            ? "Unable to sign in. Please try again."
            : "",
      )
    }
    if (pathname === "/api/auth/oidc" && request.method === "GET" && mode === "oidc")
      return sessions.start(url.searchParams.get("returnTo"))
    if (pathname === "/api/auth/callback" && request.method === "GET" && mode === "oidc")
      return sessions.callback(request)
    if (["/api/auth/login", "/api/auth/logout"].includes(pathname)) {
      if (request.method !== "POST") throw new AuthError(405, "Method not allowed")
      if (request.headers.get("origin") !== this.origin || request.headers.get("sec-fetch-site") === "cross-site")
        throw new AuthError(403, "Request origin denied")
      if (pathname === "/api/auth/logout") {
        if (request.headers.get(requestHeader) !== "1") throw new AuthError(403, "Request header required")
        return new Response(null, { status: 204, headers: { "Set-Cookie": sessions.logout() } })
      }
      if (mode !== "basic") throw new AuthError(403, "Password sign-in is disabled")
      if (request.headers.get("content-type")?.split(";")[0] !== "application/x-www-form-urlencoded")
        throw new AuthError(415, "Expected a login form")
      const reader = request.body?.getReader()
      if (!reader) throw new AuthError(400, "Login form required")
      const chunks: Uint8Array[] = []
      let size = 0
      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          size += value.length
          if (size > 16384) {
            await reader.cancel()
            throw new AuthError(413, "Login form too large")
          }
          chunks.push(value)
        }
      } finally {
        reader.releaseLock()
      }
      const form = new URLSearchParams(Buffer.concat(chunks).toString("utf8"))
      const returnTo = sessions.returnPath(form.get("returnTo"))
      try {
        const username = form.get("username") ?? ""
        const password = form.get("password") ?? ""
        const principal = this.basicPrincipal(
          new Request(request.url, {
            headers: {
              Authorization: "Basic " + Buffer.from(`${username}:${password}`).toString("base64"),
            },
          }),
        )
        return new Response(null, {
          status: 303,
          headers: { Location: returnTo, "Set-Cookie": await sessions.issue(principal) },
        })
      } catch (error) {
        if (!(error instanceof AuthError) || error.status !== 401) throw error
        return loginPage(sessions.prefix, mode, returnTo, "Invalid username or password.", 401)
      }
    }
    return undefined
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
