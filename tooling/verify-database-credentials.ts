/** Prove stable deployment credentials work across embedded database restarts. */
import assert from "node:assert/strict"
import { createServer } from "node:net"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { randomBytes } from "node:crypto"
import { Surreal } from "surrealdb"
import { validateConfig } from "../runtime/config"
import { prepareDatabaseConfig } from "../runtime/database-config"
import { runSchemaMigration } from "../runtime/surreal-schema"

const temp = await mkdtemp(path.join(os.tmpdir(), "database-credentials-"))
const listener = createServer()
await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", resolve))
const address = listener.address()
assert(address && typeof address !== "string")
const port = address.port
await new Promise<void>((resolve) => listener.close(() => resolve()))
const config = prepareDatabaseConfig(
  validateConfig({
    surrealdbUrl: `http://127.0.0.1:${port}`,
    surrealdbPort: port,
    surrealdbStorage: `rocksdb://${temp}/database`,
    surrealdbRootPass: randomBytes(32).toString("base64url"),
  }),
  false,
)
try {
  for (let start = 0; start < 2; start++) {
    const child = Bun.spawn(
      [
        Bun.env.SURREAL_BINARY ?? "surreal",
        "start",
        "--no-banner",
        "--bind",
        `127.0.0.1:${port}`,
        config.surrealdbStorage,
      ],
      {
        stdout: "ignore",
        stderr: "ignore",
        env: { PATH: process.env.PATH, SURREAL_USER: "root", SURREAL_PASS: config.surrealdbRootPass! },
      },
    )
    const db = new Surreal()
    try {
      const deadline = Date.now() + 15_000
      let ready = false
      while (Date.now() < deadline && child.exitCode === null) {
        try {
          ready = (await fetch(config.surrealdbUrl + "/health")).ok
        } catch {
          /* Startup. */
        }
        if (ready) break
        await Bun.sleep(50)
      }
      assert(ready, "Persistent database failed to start")
      await runSchemaMigration(config)
      await db.connect(config.surrealdbUrl)
      await assert.rejects(db.signin({ username: "root", password: "root" }))
      await db.signin({ username: "root", password: config.surrealdbRootPass! })
      await db.use({ namespace: config.surrealdbNamespace, database: config.surrealdbDatabase })
      if (start === 0)
        await db
          .query(
            "CREATE task:retained SET state = 'SUCCESS', workflow_id = 'retained', type = 'fixture', last_updated = time::now()",
          )
          .collect()
      const [rows] = await db.query<[{ id: unknown }[]]>("SELECT id FROM task:retained").collect()
      assert.equal(rows.length, 1)
    } finally {
      await db.close()
      child.kill("SIGTERM")
      await child.exited
    }
  }
  process.stdout.write(
    "Database credentials acceptance passed: fixed password rejected; stable secret and data survive restart\n",
  )
} finally {
  await rm(temp, { recursive: true, force: true })
}
