import { execFileSync } from "child_process"
import { dirname, resolve } from "path"
import { fileURLToPath } from "url"

const COMPOSE_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../../../test_project/docker-compose.yml")
const SKIP = !!process.env.E2E_SKIP_COMPOSE
const SHOULD_BUILD = process.env.E2E_SKIP_BUILD !== "1" && process.env.E2E_SKIP_BUILD !== "true"

export function composeUp() {
    if (SKIP) {
        console.log("E2E_SKIP_COMPOSE=1 — skipping docker compose up")
        return
    }
    console.log("Starting docker compose stack...")
    const args = ["compose", "-f", COMPOSE_FILE, "--profile", "interactive", "up", "-d"]
    if (SHOULD_BUILD) {
        args.push("--build")
    } else {
        console.log("E2E_SKIP_BUILD=1 — using prebuilt docker images")
    }
    args.push("--wait")
    execFileSync(
        "docker",
        args,
        { stdio: "inherit", timeout: 600_000 },
    )
}

export function composeDown() {
    if (SKIP) {
        console.log("E2E_SKIP_COMPOSE=1 — skipping docker compose down")
        return
    }
    console.log("Stopping docker compose stack...")
    try {
        execFileSync(
            "docker",
            ["compose", "-f", COMPOSE_FILE, "--profile", "interactive", "down", "-v", "--remove-orphans"],
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
        return execFileSync("docker", ["compose", "-f", COMPOSE_FILE, "--profile", "interactive", ...args], {
            encoding: "utf8",
            timeout: 60_000,
        })
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
