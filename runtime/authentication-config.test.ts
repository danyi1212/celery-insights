import { describe, expect, it } from "vitest"
import { authenticationConfig } from "./authentication-config"
import { validateConfig } from "./config"
import { resolveConfig, describeConfig } from "./config-loader"
import { pythonConfig } from "./python-config"
import { redactConfig } from "./debug-bundle"

const account = { username: "admin", password: "synthetic-secret", roles: ["administrator"] }
const sessionSecret = Buffer.alloc(32, 7).toString("base64url")
const values = { authSessionSecret: sessionSecret, publicUrl: "https://insights.example", authAccounts: [account] }
const preamble =
  'schema_version = 1\ninstallation.public_url = "https://insights.example"\nauthentication.session.secret = "' +
  sessionSecret +
  '"\n'
const entry = '[[authentication.accounts]]\nusername = "admin"\nroles = ["administrator"]\n'

function resolve(source: string, env: Record<string, string> = {}, secret = "synthetic-secret\n") {
  return resolveConfig({
    env,
    configFile: "/config/app.toml",
    readFile: (file) => {
      if (file === "/config/app.toml") return preamble + entry + source
      if (file === "/config/secret") return secret
      throw new Error("private file contents")
    },
  })
}

describe("configured authentication", () => {
  it.each([
    ['password = "synthetic-secret"', {}],
    ['password_file = "secret"', {}],
    ['password_env = "INSIGHTS_ADMIN_PASSWORD"', { INSIGHTS_ADMIN_PASSWORD: "synthetic-secret" }],
  ])("resolves a password source and keeps it out of diagnostics/Python: %s", (source, env) => {
    const result = resolve(source, env)
    expect(result.authentication?.accounts).toEqual([account])
    expect(result.authentication?.public_origin).toBe("https://insights.example")
    for (const output of [
      describeConfig(result),
      redactConfig(result.config, true),
      pythonConfig(result.config, false),
    ])
      expect(JSON.stringify(output)).not.toContain("synthetic-secret")
    expect(result.config).not.toHaveProperty("controlPassword")
  })
  it.each([
    'password = "one"\npassword_file = "secret"',
    'password_file = "missing"',
    'password_env = "MISSING_PASSWORD"',
    'password_env = "bad ref"',
    'password = ""',
    'password = "one"\nunknown = "private"',
    "",
  ])("fails closed on invalid sources without revealing secrets: %s", (source) => {
    expect(() => resolve(source)).toThrow(/authentication.accounts/)
  })
  it("strips one terminal newline only and bounds secret content", () => {
    expect(resolve('password_file = "secret"', {}, "secret\r\n").authentication?.accounts[0].password).toBe("secret")
    expect(() => resolve('password_file = "secret"', {}, "secret\n\n")).toThrow(/./)
    expect(() => resolve('password_file = "secret"', {}, "a".repeat(4097))).toThrow(/./)
  })
  it("rejects duplicate accounts, missing accounts and incomplete OIDC without fallback", () => {
    expect(() => authenticationConfig(validateConfig({ ...values, authAccounts: [account, account] }))).toThrow(
      "Duplicate",
    )
    expect(() => authenticationConfig(validateConfig({ ...values, authAccounts: [] }))).toThrow("Explicit accounts")
    expect(() => authenticationConfig(validateConfig({ ...values, authMode: "oidc" }))).toThrow("Cannot combine")
    expect(() =>
      resolveConfig({
        env: {},
        configFile: "/config/app.toml",
        readFile: () => preamble + 'authentication.accounts = "secret"',
      }),
    ).toThrow("Expected an array")
  })
  it.each([
    { publicUrl: "http://insights.example" },
    { publicUrl: "https://user:private@insights.example" },
    { publicUrl: undefined },
    { authAccounts: [{ ...account, roles: ["unknown"] }] },
    { authAccounts: [{ ...account, username: "bad:username" }] },
  ])("rejects invalid trust or account settings", (overrides) => {
    expect(() => authenticationConfig(validateConfig({ ...values, ...overrides }))).toThrow(/./)
  })
  it("does not accept retired identity settings", () => {
    for (const setting of [
      "authentication.bootstrap.enabled = true",
      'database.control.password = "private"',
      "authentication.sessions.idle_seconds = 600",
    ])
      expect(() =>
        resolveConfig({ env: {}, configFile: "/config/app.toml", readFile: () => preamble + setting }),
      ).toThrow("Unknown configuration")
  })
})

describe("OIDC deployment configuration", () => {
  const oidcValues = {
    authMode: "oidc",
    publicUrl: "https://insights.example",
    authSessionSecret: sessionSecret,
    oidcIssuer: "https://idp.example/realm",
    oidcClientId: "insights",
    oidcRoleMappings: [{ claim: "groups", value: "admins", roles: ["administrator"] }],
  }
  it("requires a shared secret, HTTPS issuer and explicit role mappings", () => {
    expect(authenticationConfig(validateConfig(oidcValues)).oidc?.issuer).toBe("https://idp.example/realm")
    for (const overrides of [
      { authSessionSecret: undefined },
      { oidcIssuer: "http://idp.example" },
      { oidcIssuer: "https://user:secret@idp.example" },
      { oidcRoleMappings: [] },
      { oidcScopes: "profile" },
      { oidcClientId: undefined },
    ])
      expect(() => authenticationConfig(validateConfig({ ...oidcValues, ...overrides }))).toThrow(/./)
  })
  it("accepts pod session/client secret overrides and excludes them from Python and diagnostics", () => {
    const result = resolveConfig({
      env: { CELERY_INSIGHTS_SESSION_SECRET: sessionSecret, CELERY_INSIGHTS_OIDC_CLIENT_SECRET: "private-idp-secret" },
      configFile: "/config.toml",
      readFile: () => `schema_version = 1
installation.public_url = "https://insights.example"
authentication.mode = "oidc"
authentication.oidc.issuer = "https://idp.example"
authentication.oidc.client_id = "insights"
[[authentication.oidc.role_mappings]]
claim = "sub"
value = "subject-123"
roles = ["viewer"]
`,
    })
    expect(result.authentication?.oidc?.client_secret).toBe("private-idp-secret")
    for (const output of [
      describeConfig(result),
      redactConfig(result.config, true),
      pythonConfig(result.config, false),
    ]) {
      expect(JSON.stringify(output)).not.toContain("private-idp-secret")
      expect(JSON.stringify(output)).not.toContain(sessionSecret)
    }
  })
})
