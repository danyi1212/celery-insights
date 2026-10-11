/** Disposable HTTPS OIDC browser acceptance. Requires a locally trusted fixture CA. */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { exportJWK, generateKeyPair, SignJWT } from "jose"
import { chromium, expect } from "@playwright/test"
import { AuthenticationHttp, secureApplicationRequest } from "../runtime/security/http"

const cert = readFileSync(process.env.OIDC_FIXTURE_CERT!)
const key = readFileSync(process.env.OIDC_FIXTURE_KEY!)
const { privateKey, publicKey } = await generateKeyPair("RS256")
const jwk = { ...(await exportJWK(publicKey)), kid: "acceptance", alg: "RS256", use: "sig" }
const codes = new Map<string, { nonce: string; challenge: string; redirect: string; role: string }>()
const provider = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  tls: { cert, key },
  async fetch(request: Request) {
    const url = new URL(request.url)
    const issuer = `https://127.0.0.1:${provider.port}`
    if (url.pathname === "/.well-known/openid-configuration")
      return Response.json({
        issuer,
        authorization_endpoint: issuer + "/authorize",
        token_endpoint: issuer + "/token",
        jwks_uri: issuer + "/jwks",
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        token_endpoint_auth_methods_supported: ["client_secret_post"],
        code_challenge_methods_supported: ["S256"],
      })
    if (url.pathname === "/jwks") return Response.json({ keys: [jwk] })
    if (url.pathname === "/authorize") {
      assert.equal(url.searchParams.get("client_id"), "insights")
      assert.equal(url.searchParams.get("code_challenge_method"), "S256")
      return new Response(
        `<html><body><h1>Fixture identity provider</h1><form method="post" action="/approve${url.search}"><label>Access <select name="role"><option value="admin">Administrator</option><option value="viewer">Viewer</option><option value="denied">Unmapped</option></select></label><button>Approve sign-in</button></form></body></html>`,
        { headers: { "Content-Type": "text/html" } },
      )
    }
    if (url.pathname === "/approve" && request.method === "POST") {
      const form = await request.formData()
      const code = crypto.randomUUID()
      const redirect = url.searchParams.get("redirect_uri")!
      codes.set(code, {
        nonce: url.searchParams.get("nonce")!,
        challenge: url.searchParams.get("code_challenge")!,
        redirect,
        role: String(form.get("role")),
      })
      const destination = new URL(redirect)
      destination.searchParams.set("code", code)
      destination.searchParams.set("state", url.searchParams.get("state")!)
      return Response.redirect(destination.href, 303)
    }
    if (url.pathname === "/token") {
      const form = await request.formData()
      assert.equal(form.get("client_secret"), "fixture-client-secret")
      const code = String(form.get("code"))
      const grant = codes.get(code)
      codes.delete(code)
      if (!grant) return Response.json({ error: "invalid_grant" }, { status: 400 })
      assert.equal(form.get("redirect_uri"), grant.redirect)
      assert.equal(
        createHash("sha256")
          .update(String(form.get("code_verifier")))
          .digest("base64url"),
        grant.challenge,
      )
      const id_token = await new SignJWT({ nonce: grant.nonce, groups: [grant.role] })
        .setProtectedHeader({ alg: "RS256", kid: "acceptance" })
        .setIssuer(issuer)
        .setAudience("insights")
        .setSubject("fixture-user")
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(privateKey)
      return Response.json({ access_token: "discarded", token_type: "Bearer", id_token, expires_in: 300 })
    }
    return new Response(null, { status: 404 })
  },
})
const prefix = process.env.URL_PREFIX ?? ""
const app = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  tls: { cert, key },
  async fetch(request: Request) {
    return (await secureApplicationRequest(
      request,
      prefix,
      auth,
      false,
      async () =>
        new Response("Signed in to Celery Insights", { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    ))!
  },
})
const origin = `https://127.0.0.1:${app.port}`
const auth = new AuthenticationHttp({
  public_origin: origin,
  public_url: origin + prefix + "/",
  mode: "oidc",
  accounts: [],
  session_secret: Buffer.alloc(32, 5).toString("base64url"),
  session_seconds: 300,
  oidc: {
    issuer: `https://127.0.0.1:${provider.port}`,
    client_id: "insights",
    client_secret: "fixture-client-secret",
    scopes: "openid profile",
    role_mappings: [
      { claim: "groups", value: "admin", roles: ["administrator"] },
      { claim: "groups", value: "viewer", roles: ["viewer"] },
    ],
  },
})
// Fail early if the fixture CA or discovery metadata is misconfigured.
await (
  await import("openid-client")
).discovery(new URL(`https://127.0.0.1:${provider.port}`), "insights", "fixture-client-secret")
const browser = await chromium.launch({ headless: true })
try {
  for (const role of ["admin", "viewer", "denied"]) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    try {
      const page = await context.newPage()
      await page.goto(origin + prefix + "/settings")
      await page.getByRole("link", { name: "Sign in with your identity provider" }).click()
      await expect(page).toHaveURL(new RegExp(`:${provider.port}/authorize`))
      if (!page.url().startsWith(`https://127.0.0.1:${provider.port}`)) {
        throw new Error("Provider navigation failed: " + page.url() + " " + (await page.locator("body").innerText()))
      }
      await page.getByLabel("Access").selectOption(role)
      await page.getByRole("button", { name: "Approve sign-in" }).click()
      if (role === "denied") {
        await expect(page).toHaveURL(origin + prefix + "/login?error=denied")
        assert.equal(
          await page.getByRole("alert").textContent(),
          "Your account does not have access to this installation.",
        )
        assert.equal((await context.request.get(origin + prefix + "/api/auth/identity")).status(), 401)
      } else {
        await expect(page).toHaveURL(origin + prefix + "/settings")
        const identity = await context.request.get(origin + prefix + "/api/auth/identity")
        assert.equal(identity.status(), 200)
        assert.equal((await identity.json()).account_id, "oidc:fixture-user")
        assert.equal((await context.request.get(origin + prefix + "/metrics")).status(), role === "admin" ? 200 : 403)
        const result = await page.evaluate(
          async (path) => (await fetch(path, { method: "POST", headers: { "X-Celery-Insights-Request": "1" } })).status,
          prefix + "/api/auth/logout",
        )
        assert.equal(result, 204)
        assert.equal((await context.request.get(origin + prefix + "/api/auth/identity")).status(), 401)
      }
    } finally {
      await context.close()
    }
  }
  process.stdout.write(
    `OIDC HTTPS browser acceptance passed (${prefix || "root"}): discovery, confidential-client PKCE, mapped roles, unmapped denial and logout\n`,
  )
} finally {
  await browser.close()
  app.stop(true)
  provider.stop(true)
}
