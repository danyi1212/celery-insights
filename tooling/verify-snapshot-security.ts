/** Native archive boundary acceptance using synthetic data only. */
import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createDebugBundleArchive, parseDebugSnapshot, importSurrealData } from "../runtime/debug-bundle"
import { parseConfig } from "../runtime/config"

const root = await mkdtemp(path.join(os.tmpdir(), "snapshot-security-"))
const data = {
  version: 1 as const,
  tasks: [{ id: "task:safe", result: "=1+1" }],
  events: [],
  workers: [{ id: "worker:⟨host:port⟩" }],
}
const options = {
  config: parseConfig({}),
  includeSecrets: false,
  clientInfo: {
    settings: {},
    screenWidth: 1,
    screenHeight: 1,
    userAgent: "fixture",
    locale: null,
    timezone: null,
    colorScheme: "unknown" as const,
    devicePixelRatio: 1,
  },
  serverInfo: {},
  retentionInfo: {},
  healthInfo: {},
  versionsInfo: {},
  recordCounts: { tasks: 1, events: 0, workers: 1 },
  surrealExport: data,
  logs: { bun: "", python: "", surrealdb: "" },
}
async function command(args: string[]) {
  const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" })
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  assert.equal(code, 0, err)
  return out
}
try {
  const bundle = path.join(root, "valid.zip")
  const sentinel = path.join(root, "installation-secret")
  await writeFile(sentinel, "OUTSIDE_SECRET_SENTINEL")
  await writeFile(bundle, await createDebugBundleArchive(options))
  const evil = path.join(root, "evil.zip")
  const sqlOnly = path.join(root, "sql-only.zip")
  const duplicate = path.join(root, "duplicate.zip")
  await command([
    "python3",
    "-c",
    `import zipfile,sys,stat,warnings
warnings.filterwarnings('ignore')
src,evil,sql,duplicate,sentinel=sys.argv[1:]
with zipfile.ZipFile(src) as source:
 entries=[(item.filename,source.read(item)) for item in source.infolist()]
 manifest=source.read("manifest.json")
 for target in [evil,sql,duplicate]:
  with zipfile.ZipFile(target,'w') as out:
   for name,content in entries:
    if target==sql and name=='source/data/surrealdb-export.json': continue
    out.writestr(name,content)
   if target==evil:
    link=zipfile.ZipInfo('source/stolen');link.create_system=3;link.external_attr=(stat.S_IFLNK|0o777)<<16
    out.writestr(link,sentinel)
    out.writestr('../outside','TRAVERSAL')
   if target==sql: out.writestr('source/data/surrealdb-export.surql',"DEFINE USER attacker ON ROOT PASSWORD 'pw' ROLES OWNER;")
   if target==duplicate: out.writestr('manifest.json',manifest)
`,
    bundle,
    evil,
    sqlOnly,
    duplicate,
    sentinel,
  ])
  const parsed = await parseDebugSnapshot(evil)
  assert.deepEqual(parsed.sourceData, data)
  const exported = path.join(root, "reexport.zip")
  await writeFile(exported, await createDebugBundleArchive({ ...options, replaySnapshot: parsed }))
  const names = await command(["unzip", "-Z1", exported])
  assert(!names.includes("stolen") && !names.includes("outside"))
  const contents = await command(["unzip", "-p", exported])
  assert(!contents.includes("OUTSIDE_SECRET_SENTINEL"))
  await assert.rejects(parseDebugSnapshot(sqlOnly), /SQL-only/)
  await assert.rejects(parseDebugSnapshot(duplicate), /duplicate entries/)
  let queries = 0
  const db = {
    query: (_sql: string, params: unknown) => {
      queries++
      assert.deepEqual((params as { workers_0: unknown }).workers_0, [{ id: "host:port", data: {} }])
      return Promise.resolve([])
    },
  }
  await importSurrealData(db as never, data)
  assert.equal(queries, 1)
  await assert.rejects(
    importSurrealData(db as never, { ...data, tasks: [{ id: "worker:wrong-table" }] }),
    /Invalid task/,
  )
  assert.equal(queries, 1)
  process.stdout.write(
    "Snapshot security acceptance passed: links/traversal, duplicate entries, SQL rejection, structured import\n",
  )
} finally {
  await rm(root, { recursive: true, force: true })
}
