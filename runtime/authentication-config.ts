import path from "node:path"
import type { Config } from "./config"

export type ConfiguredAccount = Config["authAccounts"][number]
export interface AuthenticationSnapshot {
  public_origin: string
  accounts: ConfiguredAccount[]
  mode?: "basic" | "oidc"
  public_url?: string
  session_secret?: string
  session_seconds?: number
  oidc?: {
    issuer: string
    client_id: string
    client_secret?: string
    scopes: string
    role_mappings: Config["oidcRoleMappings"]
  }
}

/** Resolve exactly one password source per account without exposing secret values. */
export function resolveAccounts(
  value: unknown,
  env: Record<string, string | undefined>,
  read: (file: string) => string,
  directory: string,
): unknown {
  if (!Array.isArray(value) || !value.length || value.length > 100)
    throw new Error("authentication.accounts: Configure between 1 and 100 explicit accounts")
  return value.map((item, index) => {
    const label = `authentication.accounts.${index}`
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      Object.keys(item).some((key) => !["username", "roles", "password", "password_file", "password_env"].includes(key))
    )
      throw new Error(`${label}: Invalid account settings`)
    const sources = ["password", "password_file", "password_env"].filter((key) => item[key] !== undefined)
    if (sources.length !== 1) throw new Error(`${label}: Specify exactly one password source`)
    let password = item.password
    if (item.password_file !== undefined) {
      if (typeof item.password_file !== "string" || !item.password_file)
        throw new Error(`${label}: Invalid password file reference`)
      try {
        password = read(path.resolve(directory, item.password_file))
      } catch {
        throw new Error(`${label}: Cannot read password file`)
      }
      if (typeof password === "string") password = password.replace(/\r?\n$/, "")
    }
    if (item.password_env !== undefined) {
      if (typeof item.password_env !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(item.password_env))
        throw new Error(`${label}: Invalid password environment reference`)
      password = env[item.password_env]
    }
    if (
      typeof password !== "string" ||
      !password ||
      Buffer.byteLength(password) > 4096 ||
      [...password].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
    )
      throw new Error(`${label}: Invalid or missing password secret`)
    return { username: item.username, roles: item.roles, password }
  })
}

/** Account secrets remain in Bun and are never projected into Python. */
export function authenticationConfig(config: Config): AuthenticationSnapshot {
  if (!config.publicUrl) throw new Error("Authentication requires installation.public_url")
  const url = new URL(config.publicUrl)
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
    throw new Error("installation.public_url: Authentication requires HTTPS without credentials, query or fragment")
  if (url.pathname.replace(/\/$/, "") !== config.urlPrefix)
    throw new Error("installation.public_url: Path must match server.url_prefix")
  if (config.authMode === "basic" && !config.authAccounts.length)
    throw new Error("authentication.accounts: Explicit accounts are required")
  if (new Set(config.authAccounts.map((account) => account.username)).size !== config.authAccounts.length)
    throw new Error("authentication.accounts: Duplicate usernames")
  if (!config.authSessionSecret)
    throw new Error("authentication.session.secret: Configure a shared 32-byte session secret")
  let oidc: AuthenticationSnapshot["oidc"]
  if (config.authMode === "oidc") {
    if (config.authAccounts.length)
      throw new Error("authentication.accounts: Cannot combine password accounts with OIDC mode")
    if (!config.oidcIssuer || !config.oidcClientId || !config.oidcRoleMappings.length)
      throw new Error("authentication.oidc: Configure issuer, client_id and explicit role_mappings")
    const issuer = new URL(config.oidcIssuer)
    if (issuer.protocol !== "https:" || issuer.username || issuer.password || issuer.search || issuer.hash)
      throw new Error("authentication.oidc.issuer: Expected an HTTPS issuer URL")
    if (!config.oidcScopes.split(/\s+/).includes("openid"))
      throw new Error("authentication.oidc.scopes: openid is required")
    oidc = {
      issuer: config.oidcIssuer,
      client_id: config.oidcClientId,
      client_secret: config.oidcClientSecret,
      scopes: config.oidcScopes,
      role_mappings: config.oidcRoleMappings,
    }
  } else if (config.oidcIssuer || config.oidcClientId || config.oidcClientSecret || config.oidcRoleMappings.length) {
    throw new Error("authentication.oidc: Select OIDC mode to configure an identity provider")
  }
  return {
    public_origin: url.origin,
    public_url: config.publicUrl,
    mode: config.authMode,
    accounts: config.authAccounts,
    session_secret: config.authSessionSecret,
    session_seconds: config.authSessionSeconds,
    oidc,
  }
}
