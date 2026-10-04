import { execFileSync } from "child_process"
import { dirname, resolve } from "path"
import { fileURLToPath } from "url"

const COMPOSE_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../../test_project/docker-compose.yml")
const composeFiles = ["-f", COMPOSE_FILE, "-f", resolve("e2e/docker-compose.auth.yml")]
const SKIP = !!process.env.E2E_SKIP_COMPOSE
const SHOULD_BUILD = process.env.E2E_SKIP_BUILD !== "1" && process.env.E2E_SKIP_BUILD !== "true"

const logInfo = (message: string) => console.warn(message)

export function composeUp() {
  if (SKIP) {
    logInfo("E2E_SKIP_COMPOSE=1 — skipping docker compose up")
    return
  }
  logInfo("Starting docker compose stack...")
  const args = ["compose", ...composeFiles, "--profile", "interactive"]
  args.push("--profile", "reverse-proxy")
  args.push("up", "-d")
  if (SHOULD_BUILD) {
    args.push("--build")
  } else {
    logInfo("E2E_SKIP_BUILD=1 — using prebuilt docker images")
  }
  args.push("--wait")
  execFileSync("docker", args, { stdio: "inherit", timeout: 600_000 })
}

export function composeDown() {
  if (SKIP) {
    logInfo("E2E_SKIP_COMPOSE=1 — skipping docker compose down")
    return
  }
  logInfo("Stopping docker compose stack...")
  try {
    execFileSync(
      "docker",
      [
        "compose",
        ...composeFiles,
        "--profile",
        "interactive",
        "--profile",
        "reverse-proxy",
        "down",
        "-v",
        "--remove-orphans",
      ],
      { stdio: "inherit", timeout: 60_000 },
    )
  } catch (e) {
    console.error("docker compose down failed:", e)
  }
}

function captureComposeOutput(args: string[]): string {
  if (SKIP) {
    return "E2E_SKIP_COMPOSE=1 - docker compose diagnostics skipped"
  }

  try {
    return execFileSync(
      "docker",
      ["compose", ...composeFiles, "--profile", "interactive", "--profile", "reverse-proxy", ...args],
      {
        encoding: "utf8",
        timeout: 60_000,
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return `docker compose ${args.join(" ")} failed: ${message}`
  }
}

export function composePs() {
  return captureComposeOutput(["ps"])
}

export function composeLogs(services: string[], tail = 200) {
  return captureComposeOutput(["logs", "--no-color", "--tail", String(tail), ...services])
}

/** Fixture authority stays inside the container, outside the public app boundary. */
export async function privateObservationQuery(sql: string): Promise<Response> {
  const output = execFileSync(
    "docker",
    [
      "compose",
      ...composeFiles,
      "exec",
      "-T",
      "celery-insights",
      "curl",
      "--fail-with-body",
      "-sS",
      "-u",
      "root:root",
      "-H",
      "Accept: application/json",
      "--data-binary",
      "@-",
      "http://127.0.0.1:8557/sql",
    ],
    { input: sql, encoding: "utf8", timeout: 10000 },
  )
  return new Response(output, { status: 200 })
}

/** Only the test harness can change OPA data; no OPA ports are published. */
export function updatePolicyFixture(data: Record<string, unknown> = {}): void {
  execFileSync(
    "docker",
    [
      "compose",
      ...composeFiles,
      "exec",
      "-T",
      "celery-insights",
      "curl",
      "--fail-with-body",
      "-sS",
      "-X",
      "PUT",
      "-H",
      "Content-Type: application/json",
      "--data-binary",
      "@-",
      "http://opa:8181/v1/data/fixture",
    ],
    { input: JSON.stringify(data), encoding: "utf8", timeout: 10000 },
  )
}

export function policyService(command: "stop" | "start"): void {
  execFileSync("docker", ["compose", ...composeFiles, command, "opa"], { stdio: "pipe", timeout: 30000 })
}

export function verifyPolicyExamples(): void {
  for (const name of ["maintenance", "no-payload", "mcp-tools", "task-scope"])
    execFileSync(
      "docker",
      [
        "compose",
        ...composeFiles,
        "exec",
        "-T",
        "opa",
        "/opa",
        "test",
        `/examples/${name}.rego`,
        `/examples/${name}_test.rego`,
      ],
      { stdio: "inherit", timeout: 10000 },
    )
}
