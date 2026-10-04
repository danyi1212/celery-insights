// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { Authorization } from "./opa"
import { AuthenticationHttp, secureApplicationRequest } from "./http"
import { permissions, payloadPermissions, routePermissions } from "./permissions"
import { LiveAuthorizationQueue } from "./live"

const principal = { account_id: "admin", roles: ["administrator" as const] }
const context = { method: "GET", path: "/metrics", transport: "http" as const }
const config = { opaDecisionUrl: "http://opa:8181/v1/data/insights/allow", opaTimeoutMs: 50 }
const snapshot = {
  public_origin: "https://insights.example",
  accounts: [{ username: "admin", password: "PRIVATE", roles: principal.roles }],
}
const headers = {
  authorization: "Basic " + Buffer.from("admin:PRIVATE").toString("base64"),
  Origin: snapshot.public_origin,
  "X-Celery-Insights-Request": "1",
}
const fake = (body: unknown) => vi.fn<typeof fetch>(async () => Response.json(body))

describe("restrictive OPA decisions", () => {
  it("sends only the versioned contract, normalizes context and does not cache", async () => {
    const fetch = fake({ result: true })
    const authorization = new Authorization(config, fetch)
    const auth = new AuthenticationHttp(snapshot, authorization)
    for (let i = 0; i < 2; i++) {
      await secureApplicationRequest(
        new Request(snapshot.public_origin + "/tools/celery/metrics?password=PRIVATE", { headers }),
        "/tools/celery",
        auth,
        false,
        async () => new Response("OK"),
      )
    }
    expect(fetch).toHaveBeenCalledTimes(2)
    const request = fetch.mock.calls[0][1]!
    expect(request.redirect).toBe("error")
    expect(JSON.parse(String(request.body))).toEqual({
      input: { version: 1, principal, actions: ["metrics.read"], request: context, installation: { replay: false } },
    })
    expect(String(request.body)).not.toContain("PRIVATE")
  })
  it("checks role ceilings, forbidden secret export and replay before contacting OPA", async () => {
    const fetch = fake({ result: true })
    const authorization = new Authorization(config, fetch)
    await expect(
      authorization.check({ account_id: "reader", roles: ["viewer"] }, ["task.input.read"], context),
    ).rejects.toMatchObject({ status: 403 })
    await expect(authorization.check(principal, ["diagnostics.secrets.export"], context)).rejects.toMatchObject({
      status: 403,
    })
    for (const action of ["backup.import", "history.clear", "retention.update", "cleanup.run"] as const)
      await expect(authorization.check(principal, [action], context, true)).rejects.toMatchObject({ status: 403 })
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each([false, null, "true", 1, {}, [], undefined])("accepts only literal boolean true: %j", async (result) => {
    const authorization = new Authorization(config, fake({ result }))
    await expect(authorization.check(principal, ["metrics.read"], context)).rejects.toMatchObject({
      status: result === false ? 403 : 503,
    })
  })
  it("fails closed on HTTP errors, redirects, malformed and oversized bodies, and network errors", async () => {
    for (const response of [
      new Response("PRIVATE", { status: 500 }),
      new Response("PRIVATE", { status: 302 }),
      new Response("not-json"),
      new Response(" ".repeat(16385) + '{"result":true}'),
    ]) {
      const authorization = new Authorization(
        config,
        vi.fn<typeof fetch>(async () => response),
      )
      await expect(authorization.check(principal, ["metrics.read"], context)).rejects.toMatchObject({
        status: 503,
        message: "Authorization policy unavailable",
      })
    }
    const authorization = new Authorization(
      config,
      vi.fn<typeof fetch>(async () => {
        throw new Error("PRIVATE")
      }),
    )
    await expect(authorization.check(principal, [], context)).rejects.toMatchObject({
      status: 503,
      message: "Authorization policy unavailable",
    })
  })
  it("bounds stalled decision and response-body time", async () => {
    for (const body of [false, true]) {
      const fetch = vi.fn<typeof globalThis.fetch>(async (_url, options) => {
        if (body)
          return new Response(
            new ReadableStream({
              start(controller) {
                options!.signal!.addEventListener("abort", () => controller.error(new Error("timeout")))
              },
            }),
          )
        return new Promise((_resolve, reject) =>
          options!.signal!.addEventListener("abort", () => reject(new Error("timeout"))),
        )
      })
      await expect(new Authorization(config, fetch).check(principal, [], context)).rejects.toMatchObject({
        status: 503,
      })
    }
  })
  it("checks every registered route before dispatch and protects navigation, identity, RPC and MCP", async () => {
    const fetch = fake({ result: false })
    const auth = new AuthenticationHttp(snapshot, new Authorization(config, fetch))
    const routes = {
      ...routePermissions,
      "GET /": [],
      "GET /api/auth/identity": [],
      "GET /api/observation/rpc": ["task.metadata.read"],
      "POST /api/observation/rpc": ["task.metadata.read"],
      "POST /mcp": payloadPermissions,
    }
    for (const [route, actions] of Object.entries(routes)) {
      const [method, path] = route.split(" ")
      const dispatch = vi.fn(async () => new Response("PRIVATE"))
      const response = await secureApplicationRequest(
        new Request(snapshot.public_origin + path, { method, headers }),
        "",
        auth,
        false,
        dispatch,
      )
      expect(response?.status).toBe(403)
      expect(dispatch).not.toHaveBeenCalled()
      expect(JSON.parse(String(fetch.mock.lastCall![1]!.body)).input.actions).toEqual(actions)
    }
    const covered = new Set(Object.values(routePermissions).flat())
    expect(permissions.filter((action) => action !== "diagnostics.secrets.export" && !covered.has(action))).toEqual([])
  })
  it("requires policy approval for upgrades and sends the bearer only to OPA", async () => {
    const fetch = fake({ result: false })
    const auth = new AuthenticationHttp(
      snapshot,
      new Authorization({ ...config, opaBearerToken: "PRIVATE-OPA" }, fetch),
    )
    const response = await secureApplicationRequest(
      new Request(snapshot.public_origin + "/api/observation/rpc", { headers: { ...headers, upgrade: "websocket" } }),
      "",
      auth,
      false,
      async () => new Response("OK"),
    )
    expect(response?.status).toBe(403)
    expect(JSON.parse(String(fetch.mock.lastCall![1]!.body)).input.request.transport).toBe("websocket")
    expect(new Headers(fetch.mock.lastCall![1]!.headers).get("authorization")).toBe("Bearer PRIVATE-OPA")
    expect(await response?.text()).not.toContain("PRIVATE-OPA")
  })
})

describe("live authorization queue", () => {
  it("preserves delivery order and discards queued data on revocation", async () => {
    const deliver = vi.fn()
    const close = vi.fn()
    const check = vi
      .fn(async () => true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    const queue = new LiveAuthorizationQueue(check, close)
    await Promise.all([
      queue.enqueue(() => deliver(1)),
      queue.enqueue(() => deliver(2)),
      queue.enqueue(() => deliver(3)),
    ])
    expect(deliver.mock.calls).toEqual([[1]])
    expect(close).toHaveBeenCalledOnce()
  })
  it("closes on decision failure or excessive pending work", async () => {
    for (const overload of [false, true]) {
      const close = vi.fn()
      const queue = new LiveAuthorizationQueue(async () => {
        throw new Error("unavailable")
      }, close)
      const deliver = vi.fn()
      await Promise.all(Array.from({ length: overload ? 65 : 1 }, () => queue.enqueue(deliver)))
      expect(close).toHaveBeenCalledOnce()
      expect(deliver).not.toHaveBeenCalled()
    }
  })
})
