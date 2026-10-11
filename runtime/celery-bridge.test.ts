import { statSync } from "node:fs"
import path from "node:path"
import { expect, it } from "vitest"
import { createCeleryBridge } from "./celery-bridge"

it("protects the socket directory from other OS users and removes it on shutdown", () => {
  const bridge = createCeleryBridge()
  const directory = path.dirname(bridge.socket)
  try {
    const metadata = statSync(directory)
    expect(metadata.mode & 0o777).toBe(0o700)
    expect(metadata.uid).toBe(process.getuid!())
  } finally {
    bridge.close()
  }
  expect(() => statSync(directory)).toThrow(/ENOENT/)
})
