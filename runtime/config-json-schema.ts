import { z } from "zod"
import { SETTINGS } from "./config-registry"
import { flatConfigSchema } from "./config"

type SchemaNode = Record<string, unknown> & { properties?: Record<string, SchemaNode> }

/** Editor/documentation schema. The resolver additionally enforces precedence and cross-field invariants. */
export function configurationJsonSchema(): SchemaNode {
  const root: SchemaNode = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Celery Insights configuration",
    type: "object",
    additionalProperties: false,
    required: ["schema_version"],
    properties: {},
  }
  function add(name: string, schema: SchemaNode): void {
    const parts = name.split(".")
    let node = root
    for (const part of parts.slice(0, -1)) {
      node.properties ??= {}
      node.properties[part] ??= { type: "object", additionalProperties: false, properties: {} }
      node = node.properties[part]
    }
    node.properties ??= {}
    node.properties[parts.at(-1)!] = schema
  }
  add("schema_version", { type: "integer", const: 1 })
  for (const setting of SETTINGS) {
    const validator = flatConfigSchema.shape[setting.key as keyof typeof flatConfigSchema.shape]
    const schema = z.toJSONSchema(validator, { io: "output", unrepresentable: "any" }) as SchemaNode
    // Environment boolean normalization is a transform. TOML itself accepts native booleans only.
    if (setting.type === "boolean") schema.type = "boolean"
    delete schema.$schema
    if (setting.secret) delete schema.default
    if (setting.key === "configFile") schema.default = ""
    // Disabled retention is represented by enabled=false, not a null TOML value.
    if (setting.key === "deadWorkerRetentionHours") {
      delete schema.anyOf
      schema.type = "number"
      schema.exclusiveMinimum = 0
    }
    if (setting.key === "authAccounts") {
      const item = schema.items as SchemaNode
      item.required = ["username", "roles"]
      item.properties!.password_file = { type: "string", minLength: 1 }
      item.properties!.password_env = { type: "string", pattern: "^[A-Za-z_][A-Za-z0-9_]*$" }
      item.oneOf = ["password", "password_file", "password_env"].map((source) => ({ required: [source] }))
    }
    add(setting.path, schema)
    if (setting.secret && setting.type === "string") add(`${setting.path}_file`, { type: "string", minLength: 1 })
  }
  add("database.observation.mode", { type: "string", enum: ["embedded", "external"] })
  for (const limit of ["retention.tasks.max_count", "retention.tasks.max_age_hours", "retention.workers.max_age_hours"])
    add(`${limit}.enabled`, { type: "boolean" })
  add("celery.options", {
    type: "object",
    description: "Data-only connection options supported by the pinned Celery adapter; validated by the resolver.",
  })
  return root
}
