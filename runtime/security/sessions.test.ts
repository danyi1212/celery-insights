import assert from "node:assert/strict"
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import { generateKeyPair, exportJWK, SignJWT } from "jose"
import { AuthenticationHttp, secureApplicationRequest } from "./http"
import type { AuthenticationSnapshot } from "../authentication-config"

const origin = "https://insights.example"
const snapshot: AuthenticationSnapshot = {
  public_origin: origin,
  public_url: origin + "/insights/",
  mode: "basic",
  session_secret: Buffer.alloc(32, 9).toString("base64url"),
  session_seconds: 300,
  accounts: [{ username: "admin", password: "configured-secret", roles: ["administrator"] }],
}
const run = async (auth: AuthenticationHttp, path: string, options: RequestInit = {}) => {
  const dispatch = vi.fn(async () => new Response("protected"))
  const response = await secureApplicationRequest(
    new Request(origin + "/insights" + path, options),
    "/insights",
    auth,
    false,
    dispatch,
  )
  return { response: response!, dispatch }
}
const login = (auth: AuthenticationHttp, password = "configured-secret", returnTo = "/insights/settings") =>
  run(auth, "/api/auth/login", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "admin", password, returnTo }),
  })
const cookie = (response: Response) => response.headers.get("set-cookie")!.split(";")[0]
afterEach(() => vi.unstubAllGlobals())

describe("browser authentication sessions", () => {
  it("redirects browser navigation to an accessible login without challenging the browser", async () => {
    const auth = new AuthenticationHttp(snapshot)
    const { response, dispatch } = await run(auth, "/settings", { headers: { Accept: "text/html" } })
    expect(response.status).toBe(303)
    expect(response.headers.get("location")).toContain("/insights/login?returnTo=")
    expect(response.headers.has("www-authenticate")).toBe(false)
    expect(dispatch).not.toHaveBeenCalled()
    const page = (await run(auth, "/login")).response
    expect(await page.text()).toContain('autocomplete="current-password"')
    expect(page.headers.get("content-security-policy")).toContain("default-src 'none'")
  })
  it("works across replicas and authenticates HTTP and WebSockets without exposing passwords", async () => {
    const { response } = await login(new AuthenticationHttp(snapshot))
    expect(response.status).toBe(303)
    expect(response.headers.get("location")).toBe("/insights/settings")
    const value = response.headers.get("set-cookie")!
    for (const attribute of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/insights/", "Max-Age=300"])
      expect(value).toContain(attribute)
    expect(value).not.toContain("configured-secret")
    const replica = new AuthenticationHttp(snapshot)
    expect((await run(replica, "/api/auth/identity", { headers: { Cookie: cookie(response) } })).response.status).toBe(
      200,
    )
    expect(
      (
        await run(replica, "/surreal/rpc", {
          headers: { Cookie: cookie(response), Origin: origin, Upgrade: "websocket" },
        })
      ).response.status,
    ).toBe(200)
  })
  it("fails closed for tampering, credential/config rotation, account removal and expiry", async () => {
    const { response } = await login(new AuthenticationHttp(snapshot))
    const good = cookie(response)
    for (const config of [
      snapshot,
      { ...snapshot, accounts: [] },
      { ...snapshot, accounts: [{ ...snapshot.accounts[0], password: "rotated" }] },
      { ...snapshot, session_secret: Buffer.alloc(32, 8).toString("base64url") },
    ]) {
      const value = config === snapshot ? good.slice(0, -1) + "!" : good
      expect(
        (await run(new AuthenticationHttp(config), "/metrics", { headers: { Cookie: value } })).response.status,
      ).toBe(401)
    }
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(Date.now() + 301000))
      expect(
        (await run(new AuthenticationHttp(snapshot), "/metrics", { headers: { Cookie: good } })).response.status,
      ).toBe(401)
    } finally {
      vi.useRealTimers()
    }
  })
  it("uses generic errors, rejects cross-site login/logout and clears the session on logout", async () => {
    const auth = new AuthenticationHttp(snapshot)
    const bad = (await login(auth, "incorrect")).response
    expect(bad.status).toBe(401)
    expect(await bad.text()).toContain("Invalid username or password")
    expect(bad.headers.has("www-authenticate")).toBe(false)
    expect(
      (await run(auth, "/api/auth/login", { method: "POST", headers: { Origin: "https://evil.example" } })).response
        .status,
    ).toBe(403)
    expect((await run(auth, "/api/auth/logout", { method: "POST", headers: { Origin: origin } })).response.status).toBe(
      403,
    )
    const out = (
      await run(auth, "/api/auth/logout", {
        method: "POST",
        headers: { Origin: origin, "X-Celery-Insights-Request": "1" },
      })
    ).response
    expect(out.status).toBe(204)
    expect(out.headers.get("set-cookie")).toContain("Max-Age=0")
    expect((await login(auth, "configured-secret", "https://evil.example/")).response.headers.get("location")).toBe(
      "/insights/",
    )
    expect((await login(auth, "configured-secret", "/other-app/")).response.headers.get("location")).toBe("/insights/")
  })
  it("bounds streamed login input and escapes reflected return paths", async () => {
    const auth = new AuthenticationHttp(snapshot)
    const response = await run(auth, "/api/auth/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded" },
      body: "x".repeat(17000),
    })
    expect(response.response.status).toBe(413)
    const page = (await run(auth, "/login?returnTo=" + encodeURIComponent('/insights/" autofocus onfocus=alert(1)')))
      .response
    expect(await page.text()).not.toContain('value="/insights/" autofocus')
  })
})

// Exercise the maintained OIDC client's discovery, exchange and real RSA signature validation.
describe("OIDC sign-in", () => {
  async function provider() {
    const issuer = "https://idp.example"
    const { privateKey, publicKey } = await generateKeyPair("RS256")
    const { privateKey: invalidKey } = await generateKeyPair("RS256")
    let badSignature = false,
      expired = false
    const jwk = { ...(await exportJWK(publicKey)), kid: "fixture", alg: "RS256", use: "sig" }
    const config: AuthenticationSnapshot = {
      ...snapshot,
      mode: "oidc",
      accounts: [],
      oidc: {
        issuer,
        client_id: "insights",
        scopes: "openid profile",
        role_mappings: [{ claim: "groups", value: "insights-viewers", roles: ["viewer"] }],
      },
    }
    let nonce = "",
      audience = "insights",
      groups = ["insights-viewers"],
      tokenIssuer = issuer
    const fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
      const href = typeof url === "string" ? url : url instanceof URL ? url.href : url.url
      if (href.endsWith("/.well-known/openid-configuration"))
        return Response.json({
          issuer,
          authorization_endpoint: issuer + "/authorize",
          token_endpoint: issuer + "/token",
          jwks_uri: issuer + "/jwks",
          response_types_supported: ["code"],
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["RS256"],
          token_endpoint_auth_methods_supported: ["none"],
          code_challenge_methods_supported: ["S256"],
        })
      if (href.endsWith("/jwks")) return Response.json({ keys: [jwk] })
      if (href.endsWith("/token")) {
        const body = new URLSearchParams(String(options?.body))
        assert.ok(body.get("code_verifier"))
        assert.equal(body.get("redirect_uri"), origin + "/insights/api/auth/callback")
        const id_token = await new SignJWT({ nonce, groups })
          .setProtectedHeader({ alg: "RS256", kid: "fixture" })
          .setIssuer(tokenIssuer)
          .setAudience(audience)
          .setSubject("user-123")
          .setIssuedAt()
          .setExpirationTime(expired ? "-1m" : "5m")
          .sign(badSignature ? invalidKey : privateKey)
        return Response.json({ access_token: "discarded", token_type: "Bearer", id_token, expires_in: 300 })
      }
      throw new Error("Unexpected provider request")
    })
    vi.stubGlobal("fetch", fetch)
    const auth = new AuthenticationHttp(config)
    const start = (await run(auth, "/api/auth/oidc?returnTo=/insights/tasks")).response
    const destination = new URL(start.headers.get("location")!)
    nonce = destination.searchParams.get("nonce")!
    expect(destination.searchParams.get("code_challenge_method")).toBe("S256")
    const callback = async (state = destination.searchParams.get("state")!) =>
      (
        await run(new AuthenticationHttp(config), "/api/auth/callback?code=fixture&state=" + state, {
          headers: { Cookie: cookie(start) },
        })
      ).response
    return {
      auth,
      config,
      callback,
      fetch,
      setSignature: () => {
        badSignature = true
      },
      setExpired: () => {
        expired = true
      },
      setAudience: (value: string) => {
        audience = value
      },
      setGroups: (value: string[]) => {
        groups = value
      },
      setIssuer: (value: string) => {
        tokenIssuer = value
      },
      setNonce: (value: string) => {
        nonce = value
      },
    }
  }
  it("completes PKCE OIDC across replicas and applies explicit role mappings", async () => {
    const fixture = await provider()
    const result = await fixture.callback()
    expect(result.status).toBe(200)
    expect(await result.text()).toContain("0;url=/insights/tasks")
    const cookies = result.headers.getSetCookie()
    expect(cookies).toHaveLength(2)
    const session = cookies[1].split(";")[0]
    const identity = (await run(fixture.auth, "/api/auth/identity", { headers: { Cookie: session } })).response
    expect(identity.status).toBe(200)
    expect(await identity.json()).toMatchObject({ account_id: "oidc:user-123" })
    expect((await run(fixture.auth, "/metrics", { headers: { Cookie: session } })).response.status).toBe(403)
    expect(session).not.toContain("discarded")
  })
  it.each(["state", "nonce", "audience", "issuer", "signature", "expired", "unmapped"])(
    "denies invalid %s without a session",
    async (kind) => {
      const fixture = await provider()
      if (kind === "signature") fixture.setSignature()
      if (kind === "expired") fixture.setExpired()
      if (kind === "nonce") fixture.setNonce("wrong")
      if (kind === "audience") fixture.setAudience("another-client")
      if (kind === "issuer") fixture.setIssuer("https://wrong.example")
      if (kind === "unmapped") fixture.setGroups(["unmapped"])
      const result = await fixture.callback(kind === "state" ? "wrong" : undefined)
      expect(result.headers.get("location")).toContain("/insights/login?error=")
      expect(result.headers.getSetCookie()).toHaveLength(1)
      expect(result.headers.get("set-cookie")).toContain("Max-Age=0")
    },
  )
})
