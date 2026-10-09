import path from "node:path"
import { spawn } from "node:child_process"
import { readFileSync, existsSync } from "node:fs"
import { parse as parseEnv } from "dotenv"
import { resolveConfig, describeConfig } from "./config-loader"
import { SETTINGS } from "./config-registry"
import { pythonConfig, pythonEnvironment } from "./python-config"
import { createCeleryBridge } from "./celery-bridge"
import { configurationJsonSchema } from "./config-json-schema"

export function exampleConfig(): string {
  return `schema_version = 1

[server]
port = 8555

[celery]
broker_url_file = "/run/secrets/insights/broker-url"
result_backend_file = "/run/secrets/insights/result-backend"
timezone = "UTC"

[database.observation]
mode = "embedded"

[database.observation.embedded]
storage = "rocksdb:///data/surreal"

[ingestion.leader_election]
enabled = true
ttl_seconds = 30
heartbeat_seconds = 10

[retention.workers.max_age_hours]
enabled = true
value = 24

[logging]
format = "json"
level = "info"
`
}

export function configReference(): string {
  return [
    "| TOML path | Type | Permanent env override | Legacy alias |",
    "| --- | --- | --- | --- |",
    ...SETTINGS.map(
      (setting) =>
        `| \`${setting.path}\`${setting.secret ? " / `_file`" : ""} | ${setting.type}${setting.secret ? "; sensitive" : ""} | ${setting.env ? `\`${setting.env}\`${setting.secret ? " / `_FILE`" : ""}` : "—"} | ${setting.legacy ? `\`${setting.legacy}\`` : "—"} |`,
    ),
    "",
    "Additional keys: `schema_version`, `database.observation.mode`, each retention limit's `enabled`, and `celery.options` (data-only connection options). `SURREALDB_EXTERNAL_URL` is a special topology compatibility alias.",
    "",
  ].join("\n")
}

function main(): void {
  const args = process.argv.slice(2)
  const command = args.shift()
  let configFile: string | undefined
  let envFile: string | undefined
  while (args.length) {
    const flag = args.shift()
    if (flag === "--config" && args[0]) configFile = args.shift()
    else if (flag === "--env-file" && args[0]) envFile = args.shift()
    else
      throw new Error(
        "Usage: config validate|show|example|schema|reference|migrate-env|python [--config PATH] [--env-file PATH]",
      )
  }
  if (command === "reference") {
    process.stdout.write(configReference())
    return
  }
  if (command === "schema") {
    process.stdout.write(`${JSON.stringify(configurationJsonSchema(), null, 2)}\n`)
    return
  }
  if (command === "example") {
    process.stdout.write(exampleConfig())
    return
  }
  let env = { ...process.env }
  if (envFile) {
    // Explicit development input, never an implicit Python source.
    try {
      env = { ...parseEnv(readFileSync(envFile, "utf8")), ...process.env }
    } catch {
      throw new Error("Cannot read selected development env file")
    }
  }
  const resolved = resolveConfig({ env, configFile })
  for (const warning of resolved.warnings) process.stderr.write(`${warning}\n`)
  if (command === "validate") {
    process.stdout.write("Configuration valid\n")
    return
  }
  if (command === "show") {
    process.stdout.write(`${JSON.stringify(describeConfig(resolved), null, 2)}\n`)
    return
  }
  if (command === "migrate-env") {
    const description = describeConfig(resolved)
    process.stdout.write("schema_version = 1\n")
    for (const setting of SETTINGS) {
      if (resolved.provenance[setting.path]?.source === "default") continue
      const item = description[setting.path] as { value: unknown }
      if (setting.secret)
        process.stdout.write(`${setting.path}_file = "/run/secrets/insights/${setting.key}" # Supply the secret here\n`)
      else process.stdout.write(`${setting.path} = ${JSON.stringify(item.value)}\n`)
    }
    if (resolved.config.surrealdbExternalUrl) process.stdout.write('database.observation.mode = "external"\n')
    return
  }
  if (command === "python") {
    const bridge = createCeleryBridge()
    const child = spawn("python", ["run.py"], {
      cwd: existsSync(path.resolve(import.meta.dir, "server/run.py"))
        ? path.resolve(import.meta.dir, "server")
        : path.resolve(import.meta.dir, "../server"),
      env: pythonEnvironment(env),
      stdio: ["inherit", "inherit", "inherit", "pipe"],
    })
    const pipe = child.stdio[3]
    if (!pipe || !("end" in pipe)) throw new Error("Cannot open Python configuration pipe")
    pipe.on("error", () => process.stderr.write("Python configuration handoff failed\n"))
    child.on("error", () => {
      bridge.close()
      process.stderr.write("Cannot start Python; activate the project virtual environment\n")
      process.exitCode = 1
    })
    pipe.end(JSON.stringify(pythonConfig(resolved.config, Boolean(resolved.config.debugBundlePath), bridge)))
    child.on("exit", (code) => {
      bridge.close()
      process.exitCode = code ?? 1
    })
    for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal))
    return
  }
  throw new Error(
    "Usage: config validate|show|example|schema|reference|migrate-env|python [--config PATH] [--env-file PATH]",
  )
}

if (import.meta.main) {
  try {
    main()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Configuration command failed"}\n`)
    process.exitCode = 1
  }
}
