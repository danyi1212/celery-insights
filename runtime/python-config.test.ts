import { describe, expect, it } from "vitest"
import { parseConfig } from "./config"
import { pythonConfig, pythonEnvironment } from "./python-config"

describe("scoped Python handoff", () => {
  it("projects only needed values and derives replay from the supervisor", () => {
    const envelope = pythonConfig(parseConfig({ SURREALDB_FRONTEND_PASS: "browser-only", PORT: "9000" }), true)
    expect(envelope.version).toBe(1)
    expect(envelope.settings).not.toHaveProperty("port")
    expect(envelope.settings).not.toHaveProperty("task_max_count")
    expect(envelope.settings.debug_snapshot_mode).toBe(true)
    expect(JSON.stringify(envelope)).not.toContain("browser-only")
    expect(envelope.settings).not.toHaveProperty("surrealdb_frontend_pass")
  })

  it("keeps application credentials out of the Python projection", () => {
    const config = parseConfig({})
    Object.assign(config, {
      surrealdbFrontendPass: "private-account",
      mcpToken: "private-mcp",
    })
    const result = pythonConfig(config, false, { socket: "/private/bridge.sock" })
    expect(result.settings).not.toHaveProperty("authentication")
    expect(JSON.stringify(result)).not.toMatch(/private-account|private-mcp/)
    expect(result.settings.bridge_socket).toBe("/private/bridge.sock")
  })

  it("does not pass inherited application secrets to the child environment", () => {
    expect(
      pythonEnvironment({
        PATH: "/bin",
        BROKER_URL: "secret",
        DEPLOYMENT_ACCOUNT_PASSWORD: "secret",
        RANDOM_TOKEN: "secret",
      }),
    ).toEqual({ PATH: "/bin", PYTHONUNBUFFERED: "1" })
  })

  it("passes the search setting to writers and disables it during replay", () => {
    const config = parseConfig({ SEARCH_INDEXING_ENABLED: "true" })
    expect(pythonConfig(config, false).settings.search_indexing_enabled).toBe(true)
    expect(pythonConfig(config, true).settings.search_indexing_enabled).toBe(false)
  })
})
