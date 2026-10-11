import { expect, it } from "vitest"
import { parseConfig } from "./config"
import { prepareDatabaseConfig } from "./database-config"
import { pythonConfig } from "./python-config"
import { redactConfig } from "./debug-bundle"

it("generates different private memory-database credentials for each installation", () => {
  const first = prepareDatabaseConfig(parseConfig({}), false)
  const second = prepareDatabaseConfig(parseConfig({}), false)
  expect(first.surrealdbRootPass).not.toBe(second.surrealdbRootPass)
  expect(first.surrealdbIngesterPass).not.toBe(second.surrealdbIngesterPass)
  expect(JSON.stringify(pythonConfig(first, false))).not.toContain(first.surrealdbRootPass!)
  expect(redactConfig(first, false).surrealdbRootPass).toBe("***REDACTED***")
})
it("requires stable configured credentials for persistent and external databases", () => {
  expect(() => prepareDatabaseConfig(parseConfig({ SURREALDB_STORAGE: "rocksdb:///data/surreal" }), false)).toThrow(
    "root_password",
  )
  const external = {
    ...parseConfig({ SURREALDB_EXTERNAL_URL: "ws://db:8000/rpc" }),
    surrealdbRootPass: "configured-secret",
  }
  expect(() => prepareDatabaseConfig(external, false)).toThrow("ingester_password")
  expect(prepareDatabaseConfig(external, true).surrealdbRootPass).toBe("configured-secret")
})
