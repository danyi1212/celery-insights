import { execFileSync } from "child_process"
import { dirname, resolve } from "path"
import { fileURLToPath } from "url"

const COMPOSE_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../../../test_project/docker-compose.yml")
const SKIP = !!process.env.E2E_SKIP_COMPOSE

export function composeUp() {
    if (SKIP) {
        console.log("E2E_SKIP_COMPOSE=1 — skipping docker compose up")
        return
    }
    console.log("Starting docker compose stack...")
    execFileSync(
        "docker",
        ["compose", "-f", COMPOSE_FILE, "--profile", "interactive", "up", "-d", "--build", "--wait"],
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
