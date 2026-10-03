import { describe, expect, it } from "vitest"
import { parseConfig } from "./config"
import { pythonConfig, pythonEnvironment } from "./python-config"

describe("scoped Python handoff", () => {
  it("projects only needed values and derives replay from the supervisor", () => {
    const envelope = pythonConfig(parseConfig({ SURREALDB_FRONTEND_PASS: "browser-only", PORT: "9000" }), true)
    expect(envelope.version).toBe(1)
    expect(envelope.settings.port).toBe(8556)
    expect(envelope.settings.debug_snapshot_mode).toBe(true)
    expect(JSON.stringify(envelope)).not.toContain("browser-only")
    expect(envelope.settings).not.toHaveProperty("surrealdb_frontend_pass")
  })

  it("does not pass inherited application secrets to the child environment", () => {
    expect(
      pythonEnvironment({
        PATH: "/bin",
        BROKER_URL: "secret",
        CELERY_INSIGHTS_BOOTSTRAP_PASSWORD: "secret",
        RANDOM_TOKEN: "secret",
      }),
    ).toEqual({ PATH: "/bin", PYTHONUNBUFFERED: "1" })
  })
})
