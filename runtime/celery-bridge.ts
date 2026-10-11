import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

/** Local process channel protected by its owner-only temporary directory. */
export function createCeleryBridge() {
  const directory = mkdtempSync(path.join(tmpdir(), "celery-insights-bridge-"))
  return {
    socket: path.join(directory, "bridge.sock"),
    close: () => rmSync(directory, { recursive: true, force: true }),
  }
}
