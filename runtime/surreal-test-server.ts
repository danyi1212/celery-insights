import { spawn, type ChildProcess } from "node:child_process"
import { createServer } from "node:net"

export interface SurrealTestServer {
  endpoint: string
  stop: () => void
}

/** Starts an isolated in-memory SurrealDB on a free port; the CLI must be on PATH. */
export const startSurrealTestServer = async (): Promise<SurrealTestServer> => {
  const port = await new Promise<number>((resolve, reject) => {
    const socket = createServer()
    socket.on("error", reject)
    socket.listen(0, "127.0.0.1", () => {
      const address = socket.address()
      if (!address || typeof address === "string") return reject(new Error("No local port available"))
      socket.close(() => resolve(address.port))
    })
  })
  let failure: Error | undefined
  const process: ChildProcess = spawn(
    "surreal",
    ["start", "--bind", `127.0.0.1:${port}`, "--user", "root", "--pass", "root", "memory"],
    { stdio: "ignore" },
  )
  process.on("error", (error) => {
    failure = error
  })
  process.on("exit", (code) => {
    failure ??= new Error(`SurrealDB exited with code ${code}`)
  })
  const stop = () => {
    process.kill("SIGTERM")
  }
  const end = Date.now() + 10_000
  while (Date.now() < end) {
    if (failure) throw new Error("Native SurrealDB tests require the SurrealDB 3.3+ CLI on PATH", { cause: failure })
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return { endpoint: `ws://127.0.0.1:${port}/rpc`, stop }
    } catch {
      /* Starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  stop()
  throw new Error("SurrealDB test instance did not become ready")
}
