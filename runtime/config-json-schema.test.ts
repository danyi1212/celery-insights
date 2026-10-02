import { expect, it } from "vitest"
import { configurationJsonSchema } from "./config-json-schema"

it("publishes strict native TOML types and port constraints", () => {
  const schema = configurationJsonSchema()
  expect(schema.additionalProperties).toBe(false)
  const server = schema.properties!.server
  expect(server.additionalProperties).toBe(false)
  expect(server.properties!.debug.type).toBe("boolean")
  expect(server.properties!.port).toMatchObject({ type: "integer", minimum: 1, maximum: 65535 })
  expect(schema.properties!.schema_version.const).toBe(1)
})

it("documents secret file inputs without embedding secret defaults", () => {
  const schema = configurationJsonSchema()
  const celery = schema.properties!.celery
  expect(celery.properties!.broker_url_file).toMatchObject({ type: "string", minLength: 1 })
  expect(celery.properties!.broker_url).not.toHaveProperty("default")
  expect(celery.properties!.legacy_python_config_file.default).toBe("")
  const serialized = JSON.stringify(schema)
  expect(serialized).not.toContain("guest:guest")
  expect(serialized).not.toContain("changeme")
})
