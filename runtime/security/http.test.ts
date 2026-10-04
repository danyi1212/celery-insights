// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { AuthenticationHttp, secureApplicationRequest, requestHeader } from "./http"
import { authorize } from "./permissions"

const origin = "https://insights.example"
const auth = new AuthenticationHttp({
  public_origin: origin,
  accounts: [
    { username: "admin", password: "secret:ü", roles: ["administrator"] },
    { username: "reader", password: "reader-secret", roles: ["viewer"] },
  ],
})
const basic = (credential = "admin:secret:ü") => "Basic " + Buffer.from(credential).toString("base64")
const request = (pathname: string, method = "GET", headers: Record<string, string> = {}) =>
  new Request(origin + pathname, { method, headers: { authorization: basic(), ...headers } })
const mutationHeaders = { origin, [requestHeader]: "1" }

const run = (req: Request, authentication: AuthenticationHttp | null = auth, replay = false, prefix = "") => {
  const dispatch = vi.fn(async () => new Response("private"))
  return { dispatch, response: secureApplicationRequest(req, prefix, authentication, replay, dispatch) }
}

describe("Bun configured-account gate", () => {
  it("challenges anonymous requests and never dispatches without valid credentials", async () => {
    for (const authorization of [
      "",
      "Bearer forged",
      basic("admin:wrong"),
      basic("missing:secret:ü"),
      "Basic !!!!",
      "Basic YWRtaW46c2VjcmV0Og==, forged",
      "Basic /w==",
      basic("nocolon"),
      basic("admin:secret:ü\0"),
    ]) {
      const { response, dispatch } = run(request("/metrics", "GET", { authorization }))
      const result = await response
      expect(result?.status).toBe(401)
      expect(result?.headers.get("www-authenticate")).toBeNull()
      expect(dispatch).not.toHaveBeenCalled()
    }
    const { response, dispatch } = run(request("/metrics"), null)
    expect((await response)?.status).toBe(503)
    expect(dispatch).not.toHaveBeenCalled()
  })
  it.each(["/", "/settings", "/api/settings/info", "/metrics", "/api/observation/rpc", "/mcp"])(
    "protects navigation and API responses: %s",
    async (path) => {
      const { response } = run(request(path))
      const result = await response
      expect(result?.status).toBe(200)
      expect(result?.headers.get("cache-control")).toBe("no-store")
      expect(result?.headers.has("set-cookie")).toBe(false)
    },
  )
  it("denies unregistered routes and arbitrary DB transports", async () => {
    for (const path of [
      "/api/unknown",
      "/surreal/rpc",
      "/surreal/sql",
      "/surreal/import",
      "/surreal/export",
      "/ws",
      "/api/auth/login",
      "/api/auth/mfa",
      "/api/auth/session",
    ]) {
      const { response, dispatch } = run(request(path))
      expect((await response)?.status).toBe(403)
      expect(dispatch).not.toHaveBeenCalled()
    }
  })
  it("returns identity and permissions without any credentials", async () => {
    const { response } = run(request("/api/auth/identity"))
    const text = await (await response)?.text()
    expect(text).toContain('"account_id":"admin"')
    expect(JSON.parse(text!)).not.toHaveProperty("password")
    expect(text).not.toContain("secret:ü")
  })
  it("enforces roles for authenticated accounts", async () => {
    for (const path of ["/api/settings/info", "/api/settings/export", "/metrics", "/surreal/rpc"])
      expect((await run(request(path, "GET", { authorization: basic("reader:reader-secret") })).response)?.status).toBe(
        403,
      )
    expect(() => authorize({ account_id: "reader", roles: ["viewer"] }, ["task.metadata.read"])).not.toThrow()
  })
  it("requires exact Origin and a custom header for mutations, including Basic-authenticated clients", async () => {
    for (const headers of <Record<string, string>[]>[
      {},
      { origin },
      { ...mutationHeaders, origin: "https://evil.example" },
      { ...mutationHeaders, [requestHeader]: "bad" },
    ]) {
      const { response, dispatch } = run(request("/api/settings/clear", "POST", headers))
      expect((await response)?.status).toBe(403)
      expect(dispatch).not.toHaveBeenCalled()
    }
    expect((await run(request("/api/settings/clear", "POST", mutationHeaders)).response)?.status).toBe(200)
    expect((await run(request("/api/settings/clear", "POST", mutationHeaders), auth, true).response)?.status).toBe(403)
  })
  it("denies cross-site reads and requires Origin for WebSockets", async () => {
    for (const headers of <Record<string, string>[]>[
      { origin: "https://evil.example" },
      { "sec-fetch-site": "cross-site" },
      { upgrade: "websocket" },
    ])
      expect((await run(request("/api/observation/rpc", "GET", headers)).response)?.status).toBe(403)
    expect((await run(request("/api/observation/rpc", "GET", { upgrade: "websocket", origin })).response)?.status).toBe(
      200,
    )
  })
  it("keeps public probes/assets available and honors the configured prefix", async () => {
    expect((await run(request("/health", "GET", { authorization: "" }), null).response)?.status).toBe(200)
    expect((await run(request("/assets/app.js", "GET", { authorization: "" }), null).response)?.status).toBe(200)
    expect((await run(request("/tools/celery/api/settings/info"), auth, false, "/tools/celery").response)?.status).toBe(
      200,
    )
  })
  it("masks unexpected failures before dispatch", async () => {
    const failing = new AuthenticationHttp({ public_origin: origin, accounts: [] })
    vi.spyOn(failing, "authenticate").mockImplementation(() => {
      throw new Error("PRIVATE-CREDENTIAL")
    })
    const { response, dispatch } = run(request("/metrics"), failing)
    const result = await response
    expect(result?.status).toBe(503)
    expect(await result?.text()).not.toContain("PRIVATE-CREDENTIAL")
    expect(dispatch).not.toHaveBeenCalled()
  })
})
