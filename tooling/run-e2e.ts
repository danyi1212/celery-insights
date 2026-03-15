import { mkdirSync } from "node:fs"
import { join } from "node:path"

const runs = [
  {
    label: "parallel-safe",
    env: { E2E_SUITE: "parallel-safe" },
  },
  {
    label: "serial",
    env: { E2E_SUITE: "serial" },
  },
] as const

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const blobRoot = join(process.cwd(), "test-results", "playwright-blob", runId)
mkdirSync(blobRoot, { recursive: true })
let exitCode = 0

for (const run of runs) {
  console.warn(`Running E2E suite: ${run.label}`)

  const proc = Bun.spawn(["bunx", "playwright", "test", "--config", "e2e/playwright.config.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...run.env,
      E2E_REPORT_MODE: "blob",
      E2E_BLOB_OUTPUT_DIR: join(blobRoot, run.label),
    },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  })

  const code = await proc.exited
  if (code !== 0) {
    exitCode = code
  }
}

console.warn("Merging E2E reports")

const mergeProc = Bun.spawn(
  ["bunx", "playwright", "merge-reports", "--config", "e2e/playwright.merge.config.ts", blobRoot],
  {
    cwd: process.cwd(),
    env: process.env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  },
)

const mergeCode = await mergeProc.exited
if (mergeCode !== 0) {
  process.exit(exitCode || mergeCode)
}

console.warn("Writing merged E2E JSON report")

const jsonMergeProc = Bun.spawn(
  ["bunx", "playwright", "merge-reports", "--config", "e2e/playwright.merge-json.config.ts", blobRoot],
  {
    cwd: process.cwd(),
    env: process.env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  },
)

const jsonMergeCode = await jsonMergeProc.exited
if (jsonMergeCode !== 0) {
  process.exit(exitCode || jsonMergeCode)
}

if (exitCode !== 0) {
  process.exit(exitCode)
}
