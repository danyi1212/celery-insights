import { emptyScope, principalScope, readScopeSchema, requireUnrestricted, type ReadScope } from "./read-scope"
import type { Config } from "../config"
import { AuthError, authorize, type Permission, type Principal } from "./permissions"

export interface PolicyContext {
  method: string
  /** Application-relative path, with the deployment prefix removed. */
  path: string
  transport: "http" | "websocket" | "mcp"
  tool?: string
  operation?: string
}

/** Roles are the permission ceiling. OPA adds an uncached veto or a narrower read scope. */
export class Authorization {
  constructor(
    private readonly config: Pick<Config, "opaDecisionUrl" | "opaTimeoutMs" | "opaBearerToken"> = {
      opaTimeoutMs: 1000,
    },
    private readonly fetchDecision: typeof fetch = fetch,
  ) {}

  async check(
    principal: Principal,
    actions: readonly Permission[],
    request: PolicyContext,
    replay = false,
  ): Promise<ReadScope> {
    authorize(principal, actions, replay)
    if (!this.config.opaDecisionUrl) return principalScope(principal, emptyScope())
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.opaTimeoutMs)
    try {
      const response = await this.fetchDecision(this.config.opaDecisionUrl, {
        method: "POST",
        redirect: "error",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(this.config.opaBearerToken ? { Authorization: `Bearer ${this.config.opaBearerToken}` } : {}),
        },
        body: JSON.stringify({ input: { version: 1, principal, actions, request, installation: { replay } } }),
      })
      if (!response.ok || !response.body) throw new Error("Unavailable")
      // Bound the entire response, including chunked bodies; the timeout also covers body reads.
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let size = 0
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.byteLength
          if (size > 16384) throw new Error("Oversized decision")
          chunks.push(value)
        }
      } finally {
        await reader.cancel()
      }
      const decision: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"))
      if (!decision || typeof decision !== "object" || !("result" in decision)) throw new Error("Invalid decision")
      let scope = emptyScope()
      if (typeof decision.result === "boolean") {
        if (!decision.result) throw new AuthError(403, "Access denied by policy")
      } else {
        const result = decision.result
        if (
          !result ||
          typeof result !== "object" ||
          !("allow" in result) ||
          typeof result.allow !== "boolean" ||
          Object.keys(result).some((key) => !["allow", "scope"].includes(key))
        )
          throw new Error("Invalid decision")
        if (!result.allow) throw new AuthError(403, "Access denied by policy")
        if (!("scope" in result)) throw new Error("Missing read scope")
        scope = readScopeSchema.parse(result.scope)
      }
      requireUnrestricted(scope, actions)
      return principalScope(principal, scope)
    } catch (error) {
      if (error instanceof AuthError) throw error
      // Never return policy errors, response bodies, URLs or service credentials to a caller.
      throw new AuthError(503, "Authorization policy unavailable")
    } finally {
      clearTimeout(timer)
      controller.abort()
    }
  }
}
