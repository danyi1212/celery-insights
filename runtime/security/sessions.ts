import { loginComplete } from "./login-page"
import { createHmac } from "node:crypto"
import { EncryptJWT, jwtDecrypt, type JWTPayload } from "jose"
import * as oidc from "openid-client"
import type { AuthenticationSnapshot } from "../authentication-config"
import { AuthError, type Principal } from "./permissions"

/** Encrypted, bounded cookies work across replicas without an identity database. */
export class Sessions {
  private readonly key: Uint8Array
  private readonly revision: string
  readonly prefix: string
  private readonly cookieName: string
  private readonly transactionName: string
  private discovery?: Promise<oidc.Configuration>
  constructor(private readonly config: AuthenticationSnapshot) {
    this.key = Buffer.from(config.session_secret!, "base64url")
    if (this.key.length !== 32) throw new Error("Invalid session secret")
    this.prefix = new URL(config.public_url ?? config.public_origin).pathname.replace(/\/$/, "")
    // Bind sessions to the entire auth configuration, including credential rotation.
    // This MAC is a revocation tag, never a password verifier or password storage.
    this.revision = createHmac("sha256", this.key).update(JSON.stringify(config)).digest("base64url")
    const installation = createHmac("sha256", this.key).update(this.prefix).digest("hex").slice(0, 12)
    this.cookieName = `__Secure-insights-${installation}`
    this.transactionName = `${this.cookieName}-oidc`
  }

  private cookie(name: string, value: string, seconds: number): string {
    return `${name}=${value}; Path=${this.prefix}/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`
  }
  private readCookie(request: Request, name: string): string | undefined {
    const values = (request.headers.get("cookie") ?? "")
      .split(";")
      .map((value) => value.trim())
      .filter((value) => value.startsWith(name + "="))
    return values.length === 1 ? values[0].slice(name.length + 1) : undefined
  }
  private async seal(payload: JWTPayload, purpose: string, seconds: number): Promise<string> {
    return new EncryptJWT({ ...payload, revision: this.revision, purpose })
      .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
      .setIssuer(this.config.public_origin)
      .setAudience(this.prefix || "/")
      .setIssuedAt()
      .setExpirationTime(`${seconds}s`)
      .encrypt(this.key)
  }
  private async open(token: string | undefined, purpose: string): Promise<JWTPayload> {
    if (!token || token.length > 4096) throw new AuthError(401, "Sign in required")
    try {
      const { payload } = await jwtDecrypt(token, this.key, {
        issuer: this.config.public_origin,
        audience: this.prefix || "/",
        keyManagementAlgorithms: ["dir"],
        contentEncryptionAlgorithms: ["A256GCM"],
      })
      if (payload.purpose !== purpose || payload.revision !== this.revision || !payload.exp)
        throw new Error("Invalid session")
      return payload
    } catch {
      throw new AuthError(401, "Sign in required")
    }
  }
  async principal(request: Request): Promise<Principal> {
    const payload = await this.open(this.readCookie(request, this.cookieName), "session")
    if (typeof payload.sub !== "string") throw new AuthError(401, "Sign in required")
    if (this.config.mode !== "oidc") {
      const account = this.config.accounts.find((account) => account.username === payload.sub)
      if (!account) throw new AuthError(401, "Sign in required")
      return { account_id: account.username, roles: [...account.roles] }
    }
    const roles = payload.roles
    if (
      !Array.isArray(roles) ||
      !roles.length ||
      roles.some((role) => !["viewer", "operator", "administrator"].includes(role))
    )
      throw new AuthError(401, "Sign in required")
    return { account_id: `oidc:${payload.sub}`, roles: roles as Principal["roles"] }
  }
  async issue(principal: Principal): Promise<string> {
    const seconds = this.config.session_seconds ?? 28800
    const token = await this.seal(
      {
        sub: principal.account_id.replace(/^oidc:/, ""),
        ...(this.config.mode === "oidc" ? { roles: principal.roles } : {}),
      },
      "session",
      seconds,
    )
    if (token.length > 3800) throw new AuthError(403, "Identity is too large")
    return this.cookie(this.cookieName, token, seconds)
  }
  logout(): string {
    return this.cookie(this.cookieName, "", 0)
  }
  returnPath(value: string | null): string {
    try {
      const url = new URL(value ?? `${this.prefix}/`, this.config.public_origin)
      if (
        url.origin === this.config.public_origin &&
        url.pathname.startsWith(`${this.prefix}/`) &&
        !url.pathname.startsWith(`${this.prefix}/api/auth/`) &&
        url.pathname !== `${this.prefix}/login`
      )
        return url.pathname + url.search
    } catch {
      /* Invalid return destinations go home. */
    }
    return `${this.prefix}/`
  }
  private provider(): Promise<oidc.Configuration> {
    const config = this.config.oidc!
    this.discovery ??= oidc
      .discovery(
        new URL(config.issuer),
        config.client_id,
        config.client_secret,
        config.client_secret ? oidc.ClientSecretPost(config.client_secret) : oidc.None(),
        { timeout: 10 },
      )
      .then((provider) => {
        oidc.enableNonRepudiationChecks(provider)
        return provider
      })
      .catch(() => {
        this.discovery = undefined
        throw new AuthError(503, "Identity provider unavailable")
      })
    return this.discovery
  }
  async start(returnTo: string | null): Promise<Response> {
    const provider = await this.provider()
    const verifier = oidc.randomPKCECodeVerifier()
    const state = oidc.randomState()
    const nonce = oidc.randomNonce()
    const transaction = await this.seal({ verifier, state, nonce, returnTo: this.returnPath(returnTo) }, "oidc", 300)
    const url = oidc.buildAuthorizationUrl(provider, {
      scope: this.config.oidc!.scopes,
      redirect_uri: `${this.config.public_origin}${this.prefix}/api/auth/callback`,
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
      code_challenge_method: "S256",
      state,
      nonce,
    })
    return new Response(null, {
      status: 303,
      headers: { Location: url.href, "Set-Cookie": this.cookie(this.transactionName, transaction, 300) },
    })
  }
  async callback(request: Request): Promise<Response> {
    const headers = new Headers({ "Set-Cookie": this.cookie(this.transactionName, "", 0) })
    try {
      const transaction = await this.open(this.readCookie(request, this.transactionName), "oidc")
      if (![transaction.verifier, transaction.state, transaction.nonce].every((value) => typeof value === "string"))
        throw new AuthError(401, "Sign in failed")
      const incoming = new URL(request.url)
      const callback = new URL(`${this.config.public_origin}${this.prefix}/api/auth/callback`)
      callback.search = incoming.search
      const tokens = await oidc.authorizationCodeGrant(await this.provider(), callback, {
        pkceCodeVerifier: transaction.verifier as string,
        expectedState: transaction.state as string,
        expectedNonce: transaction.nonce as string,
        idTokenExpected: true,
      })
      const claims = tokens.claims()
      if (!claims?.sub || claims.sub.length > 512) throw new AuthError(403, "Account is not authorized")
      const roles = [
        ...new Set(
          this.config.oidc!.role_mappings.flatMap((mapping) => {
            const claim = claims[mapping.claim]
            return (
              typeof claim === "string"
                ? claim === mapping.value
                : Array.isArray(claim) && claim.includes(mapping.value)
            )
              ? mapping.roles
              : []
          }),
        ),
      ]
      if (!roles.length) throw new AuthError(403, "Account is not authorized")
      headers.append("Set-Cookie", await this.issue({ account_id: `oidc:${claims.sub}`, roles }))
      return loginComplete(
        this.returnPath(typeof transaction.returnTo === "string" ? transaction.returnTo : null),
        headers,
      )
    } catch (error) {
      // Provider responses/tokens never enter logs or the browser error page.
      headers.set(
        "Location",
        `${this.prefix}/login?error=${error instanceof AuthError && error.status === 403 ? "denied" : "oidc"}`,
      )
      return new Response(null, { status: 303, headers })
    }
  }
}
