import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomBytes } from "node:crypto"

/** A private process channel, never an account/session credential. */
export function createCeleryBridge() {
  const directory = mkdtempSync(path.join(tmpdir(), "celery-insights-bridge-"))
  return {
    token: randomBytes(32).toString("base64url"),
    socket: path.join(directory, "bridge.sock"),
    close: () => rmSync(directory, { recursive: true, force: true }),
  }
}
