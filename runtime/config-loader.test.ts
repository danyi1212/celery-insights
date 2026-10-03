import { describe, expect, it } from "vitest"
import { resolveConfig, describeConfig } from "./config-loader"
import { SETTINGS } from "./config-registry"
import { redactConfig } from "./debug-bundle"
import { pythonConfig, pythonEnvironment } from "./python-config"
import { ENV_KEY_MAP } from "./config"

function fromToml(toml: string, env: Record<string, string> = {}, files: Record<string, string> = {}) {
  return resolveConfig({
    env,
    configFile: "/config/app.toml",
    readFile: (file) => {
      if (file === "/config/app.toml") return `schema_version = 1\n${toml}`
      if (file in files) return files[file]
      throw new Error("unreadable")
    },
  })
}

describe("Bun configuration resolver", () => {
  it("defaults search indexing off and accepts its TOML and environment settings", () => {
    expect(fromToml("").config.searchIndexingEnabled).toBe(false)
    expect(fromToml("[search.indexing]\nenabled = true").config.searchIndexingEnabled).toBe(true)
    expect(fromToml("", { SEARCH_INDEXING_ENABLED: "true" }).config.searchIndexingEnabled).toBe(true)
    expect(
      fromToml("[search.indexing]\nenabled = true", {
        CELERY_INSIGHTS_SEARCH_INDEXING_ENABLED: "false",
      }).config.searchIndexingEnabled,
    ).toBe(false)
  it("validates optional OPA configuration and redacts service credentials", () => {
    expect(fromToml("").config.opaDecisionUrl).toBeUndefined()
    const resolved = fromToml(
      '[authorization.opa]\ndecision_url = "https://opa.example/v1/data/insights/allow"\nbearer_token_file = "opa-token"\ntimeout_ms = 500',
      {},
      { "/config/opa-token": "PRIVATE-OPA\n" },
    )
    expect(resolved.config.opaBearerToken).toBe("PRIVATE-OPA")
    expect(JSON.stringify(redactConfig(resolved.config, true))).not.toContain("PRIVATE-OPA")
    expect(JSON.stringify(pythonConfig(resolved.config, false))).not.toContain("opa")
    expect(pythonEnvironment({ CELERY_INSIGHTS_OPA_BEARER_TOKEN: "PRIVATE-OPA" })).not.toHaveProperty(
      "CELERY_INSIGHTS_OPA_BEARER_TOKEN",
    )
    expect(JSON.stringify(describeConfig(resolved))).not.toContain("PRIVATE-OPA")
    for (const url of [
      "ftp://opa/v1/data/allow",
      "https://user:secret@opa/v1/data/allow",
      "https://opa/v1/data/allow?secret=1",
      "https://opa/v1/data/allow#fragment",
      "https://opa/v1/policies/allow",
    ])
      expect(() => fromToml(`[authorization.opa]\ndecision_url = "${url}"`)).toThrow("opa")
    expect(() => fromToml("[authorization.opa]\ntimeout_ms = 0")).toThrow("opa")
    expect(() => fromToml('[authorization.opa]\nbearer_token = "secret"')).toThrow("requires decision_url")
    expect(() =>
      fromToml('[authorization.opa]\ndecision_url = "http://opa/v1/data/allow"\nbearer_token = "secret"'),
    ).toThrow("requires HTTPS")
  })
  it("preserves reverse-proxy and MCP settings through the structured resolver", () => {
    const resolved = fromToml(
      '[server]\nurl_prefix = "insights"\n[mcp]\ncursor_secret_file = "mcp-secret"\nallowed_hosts = "insights.example"',
      {},
      { "/config/mcp-secret": "synthetic-mcp-token\n" },
    )
    expect(resolved.config.urlPrefix).toBe("/insights")
    expect(resolved.config.mcpCursorSecret).toBe("synthetic-mcp-token")
    expect(resolved.config.mcpAllowedHosts).toBe("insights.example")
    expect(JSON.stringify(describeConfig(resolved))).not.toContain("synthetic-mcp-token")
    expect(() => fromToml('[server]\nurl_prefix = "../insights"')).toThrow("URL_PREFIX must be a URL path")
  })
  it("rejects unknown empty tables and unsupported executable Celery options", () => {
    expect(() => fromToml("[misspelled]")).toThrow("Unknown configuration table")
    expect(() => fromToml('[celery.options]\nimports = ["arbitrary.module"]')).toThrow("Unsupported data-only")
    expect(() => fromToml("[celery.options]\nbroker_connection_timeout = 1979-05-27")).toThrow("finite data")
    expect(
      fromToml('[celery.options.broker_transport_options]\nmaster_name = "mymaster"').config.celeryOptions,
    ).toEqual({ broker_transport_options: { master_name: "mymaster" } })
  })
  it("catalogues every existing environment mapping", () => {
    const catalog = new Set(SETTINGS.map((s) => s.legacy))
    catalog.add("SURREALDB_EXTERNAL_URL")
    expect(Object.keys(ENV_KEY_MAP).filter((key) => !catalog.has(key))).toEqual([])
  })

  it("applies file, legacy and current precedence with provenance", () => {
    const resolved = fromToml("[server]\nport = 9000", { CELERY_INSIGHTS_PORT: "9002" })
    expect(resolved.config.port).toBe(9002)
    expect(resolved.provenance["server.port"].source).toBe("env:CELERY_INSIGHTS_PORT")
    expect(() => fromToml("", { PORT: "9000", CELERY_INSIGHTS_PORT: "9001" })).toThrow("Conflicting legacy")
    expect(fromToml("", { PORT: "9001", CELERY_INSIGHTS_PORT: "9001" }).warnings).toHaveLength(1)
  })

  it("validates TOML types and prevents unknown environment/key typos", () => {
    expect(() => fromToml('[server]\nport = "9000"')).toThrow("Expected number")
    expect(() => fromToml("[server]\nprot = 9000")).toThrow("Unknown configuration key")
    expect(() => fromToml("", { CELERY_INSIGHTS_PROT: "9000" })).toThrow("Unknown application environment")
    expect(() => fromToml("", { INGESTION_ENABLED: "flase" })).toThrow("Expected boolean")
  })

  it("ignores unrelated CI platform variables", () => {
    expect(fromToml("", { CI: "true", CI_JOB_ID: "123", CI_PIPELINE_ID: "456" }).config.port).toBe(8555)
  })

  it("does not reveal invalid secret values or TOML contents", () => {
    expect(() => fromToml('[celery]\nbroker_url = "DO-NOT-PRINT"\nbroker_url = "another"')).toThrow("Invalid TOML")
    expect(() => fromToml('[database.observation]\nurl = "DO-NOT-PRINT"')).toThrow("Invalid configuration value")
    const error = (() => {
      try {
        fromToml('[database.observation]\nurl = "DO-NOT-PRINT"')
      } catch (caught) {
        return String(caught)
      }
    })()
    expect(error).not.toContain("DO-NOT-PRINT")
  })

  it("resolves relative secret files and removes only one final newline", () => {
    const result = fromToml('[celery]\nbroker_url_file = "broker"', {}, { "/config/broker": "  secret  \r\n" })
    expect(result.config.brokerUrl).toBe("  secret  ")
    expect(JSON.stringify(describeConfig(result))).not.toContain("  secret  ")
    expect(describeConfig(result)["celery.broker_url"]).toMatchObject({ value: "[redacted]" })
  })

  it("allows higher priority secret source replacement without reading losing files", () => {
    const result = fromToml('[celery]\nbroker_url_file = "missing"', { CELERY_INSIGHTS_BROKER_URL: "replacement" })
    expect(result.config.brokerUrl).toBe("replacement")
    expect(() =>
      fromToml("", { CELERY_INSIGHTS_BROKER_URL: "value", CELERY_INSIGHTS_BROKER_URL_FILE: "path" }),
    ).toThrow("not both")
    expect(() => fromToml('[celery]\nbroker_url = "value"\nbroker_url_file = "file"')).toThrow("not both")
    expect(() => fromToml('[celery]\nbroker_url_file = "missing"')).toThrow("Cannot read secret")
    expect(() => fromToml("", { CELERY_INSIGHTS_BROKER_URL: "" })).toThrow("Invalid empty")
  })

  it("supports explicit disabling of default-on worker retention", () => {
    expect(fromToml("[retention.workers.max_age_hours]\nenabled = false").config.deadWorkerRetentionHours).toBeNull()
    expect(() => fromToml("[retention.tasks.max_count]\nenabled = true")).toThrow("requires a value")
  })

  it("unifies topology while preserving old environment behavior", () => {
    expect(fromToml('[database.observation]\nurl = "ws://shared:9000/rpc"').config.surrealdbExternalUrl).toBe(
      "ws://shared:9000/rpc",
    )
    expect(fromToml("[database.observation.embedded]\nport = 9000").config.surrealdbUrl).toBe("ws://localhost:9000/rpc")
    expect(() => fromToml('[database.observation]\nmode = "embedded"\nurl = "ws://shared/rpc"')).toThrow(
      "cannot specify",
    )
    expect(
      resolveConfig({ env: { SURREALDB_URL: "ws://a/rpc", SURREALDB_EXTERNAL_URL: "ws://b/rpc" }, exists: () => false })
        .config.surrealdbUrl,
    ).toBe("ws://a/rpc")
  })

  it("does not execute implicit Python config and rejects mixed configuration", () => {
    expect(fromToml("").config.configFile).toBe("")
    expect(() => fromToml('[celery]\nlegacy_python_config_file = "config.py"\nbroker_url = "amqp://host"')).toThrow(
      "cannot coexist",
    )
  })

  it("requires explicit files and schema version, while absent implicit files allow env-only startup", () => {
    expect(resolveConfig({ env: {}, exists: () => false }).config.port).toBe(8555)
    expect(() =>
      resolveConfig({
        env: { CELERY_INSIGHTS_CONFIG_FILE: "/missing" },
        readFile: () => {
          throw new Error()
        },
      }),
    ).toThrow("Cannot read selected")
    expect(() => resolveConfig({ env: {}, configFile: "/config", readFile: () => "schema_version = 2" })).toThrow(
      "schema_version",
    )
  })
})
