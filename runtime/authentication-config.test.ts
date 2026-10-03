import { describe, expect, it } from "vitest"
import { authenticationConfig } from "./authentication-config"
import { validateConfig } from "./config"
import { resolveConfig, describeConfig } from "./config-loader"
import { pythonConfig } from "./python-config"
import { redactConfig } from "./debug-bundle"

const account = { username: "admin", password: "synthetic-secret", roles: ["administrator"] }
const values = { publicUrl: "https://insights.example", authAccounts: [account] }
const preamble = 'schema_version = 1\ninstallation.public_url = "https://insights.example"\n'
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
  it("rejects duplicate accounts, missing accounts and unsupported OIDC without fallback", () => {
    expect(() => authenticationConfig(validateConfig({ ...values, authAccounts: [account, account] }))).toThrow(
      "Duplicate",
    )
    expect(() => authenticationConfig(validateConfig({ ...values, authAccounts: [] }))).toThrow("Explicit accounts")
    expect(() => authenticationConfig(validateConfig({ ...values, authMode: "oidc" }))).toThrow("not implemented")
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
