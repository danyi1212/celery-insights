import { describe, expect, it, vi } from "vitest"
import { Authorization } from "./opa"
import { emptyScope, intersectScopes, principalScope, readScopeSchema, scopeFingerprint } from "./read-scope"

const principal = { account_id: "monitor", roles: ["administrator" as const] }
const context = { method: "POST", path: "/api/observation/rpc", transport: "http" as const, operation: "list" }
const check = (result: unknown, actions: Parameters<Authorization["check"]>[1] = ["task.metadata.read"]) =>
  new Authorization(
    { opaDecisionUrl: "http://opa/v1/data/allow", opaTimeoutMs: 1000 },
    vi.fn<typeof fetch>(async () => Response.json({ result })),
  ).check(principal, actions, context)

describe("bounded OPA read scopes", () => {
  it("intersects selectors and field restrictions without widening either decision", () => {
    const scope = intersectScopes(
      { task_ids: ["a", "b"], task_types: ["report"], deny_fields: ["task.input.read"] },
      { task_ids: ["b", "c"], worker_hostnames: [], deny_fields: ["task.result.read"] },
    )
    expect(scope).toEqual({
      task_ids: ["b"],
      task_types: ["report"],
      worker_hostnames: [],
      deny_fields: ["task.input.read", "task.result.read"],
    })
    expect(intersectScopes(scope, emptyScope())).toEqual(scope)
    expect(intersectScopes(scope, { task_ids: [], deny_fields: [] }).task_ids).toEqual([])
    expect(scopeFingerprint({ ...scope, deny_fields: [...scope.deny_fields].reverse() })).toBe(scopeFingerprint(scope))
  })
  it("role restrictions always remove payload groups even without OPA", () => {
    expect(principalScope({ account_id: "reader", roles: ["viewer"] }, emptyScope()).deny_fields).toHaveLength(5)
  })
  it("accepts boolean compatibility and strict structured scopes", async () => {
    expect(await check(true)).toEqual(emptyScope())
    expect(await check({ allow: true, scope: { task_ids: [] } })).toEqual({ task_ids: [], deny_fields: [] })
    await expect(check({ allow: false })).rejects.toMatchObject({ status: 403 })
  })
  it("fails closed for unbounded, unknown or malformed scope fields", async () => {
    for (const scope of [
      null,
      { task_ids: "all" },
      { task_ids: Array(101).fill("x") },
      { task_ids: [""] },
      { deny_fields: ["arbitrary.path"] },
      { sql: "true" },
      { task_types: ["x".repeat(257)] },
    ]) {
      expect(readScopeSchema.safeParse(scope).success).toBe(false)
      await expect(check({ allow: true, scope })).rejects.toMatchObject({ status: 503 })
    }
    await expect(check({ allow: true })).rejects.toMatchObject({ status: 503 })
    await expect(check({ allow: true, scope: {}, extra: true })).rejects.toMatchObject({ status: 503 })
  })
  it("denies operations that cannot safely honor a restricted policy view", async () => {
    for (const action of [
      "diagnostics.export",
      "backup.import",
      "history.clear",
      "retention.update",
      "cleanup.run",
    ] as const)
      await expect(check({ allow: true, scope: { task_ids: ["a"] } }, [action])).rejects.toMatchObject({ status: 403 })
    expect(await check({ allow: true, scope: { deny_fields: ["task.result.read"] } }, ["backup.export"])).toEqual({
      deny_fields: ["task.result.read"],
    })
  })
})
