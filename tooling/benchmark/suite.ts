import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { calibrateNoise } from "./calibrate"

type Scenario = { name: string; repetitions: number; args: string[]; environment: Record<string, string> }
const execute = promisify(execFile)
const variables = new Set(["BENCH_CPU", "BENCH_MEMORY", "BENCH_STORAGE", "BENCH_INDEXING", "BENCH_NOTIFICATION_BUFFER"])
export function suiteManifest(value: unknown): { schemaVersion: 1; scenarios: Scenario[] } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid suite manifest")
  const manifest = value as { schemaVersion?: unknown; scenarios?: unknown }
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.scenarios) || !manifest.scenarios.length)
    throw new Error("Invalid suite manifest")
  const names = new Set<string>()
  for (const scenario of manifest.scenarios) {
    if (
      !scenario ||
      typeof scenario !== "object" ||
      !/^[a-z0-9][a-z0-9-]{0,63}$/.test(scenario.name) ||
      names.has(scenario.name) ||
      !Number.isInteger(scenario.repetitions) ||
      scenario.repetitions < 1 ||
      scenario.repetitions > 20 ||
      !Array.isArray(scenario.args) ||
      scenario.args.some(
        (arg: unknown) =>
          typeof arg !== "string" ||
          ["--output", "--image", "--expected-source-sha"].some(
            (option) => arg === option || arg.startsWith(`${option}=`),
          ),
      ) ||
      (scenario.args.length > 0 && !scenario.args[0].startsWith("--")) ||
      !scenario.environment ||
      typeof scenario.environment !== "object" ||
      Array.isArray(scenario.environment) ||
      Object.entries(scenario.environment).some(([name, entry]) => !variables.has(name) || typeof entry !== "string")
    )
      throw new Error("Invalid scenario name, repetitions, arguments or resource environment")
    names.add(scenario.name)
  }
  return value as { schemaVersion: 1; scenarios: Scenario[] }
}

export async function runSuite(manifestPath: string, output: string, image: string, expectedSourceSha?: string) {
  const raw = await readFile(manifestPath, "utf8")
  const manifest = suiteManifest(JSON.parse(raw))
  await mkdir(dirname(resolve(output)), { recursive: true })
  await mkdir(output)
  const summary: {
    schemaVersion: number
    manifestSha256: string
    image: string
    attempts: unknown[]
    startedAt: string
    finishedAt?: string
  } = {
    schemaVersion: 1,
    manifestSha256: createHash("sha256").update(raw).digest("hex"),
    image,
    attempts: [],
    startedAt: new Date().toISOString(),
  }
  const save = () => writeFile(resolve(output, "suite.json"), JSON.stringify(summary, null, 2) + "\n")
  await writeFile(resolve(output, "manifest.json"), raw, { flag: "wx" })
  await save()
  for (const scenario of manifest.scenarios) {
    const results: unknown[] = []
    for (let repetition = 1; repetition <= scenario.repetitions; repetition++) {
      const directory = resolve(output, `${scenario.name}-${repetition}`)
      const started = performance.now()
      let code = 0
      let stdout = "",
        stderr = ""
      try {
        const result = await execute(
          process.execPath,
          [
            "run",
            "tooling/benchmark/cli.ts",
            ...scenario.args,
            "--image",
            image,
            ...(expectedSourceSha ? ["--expected-source-sha", expectedSourceSha] : []),
            "--output",
            directory,
          ],
          {
            env: {
              ...process.env,
              BENCH_CPU: "2",
              BENCH_MEMORY: "2g",
              BENCH_STORAGE: "rocksdb:///data/store",
              BENCH_INDEXING: "false",
              BENCH_NOTIFICATION_BUFFER: "100",
              ...scenario.environment,
            },
            maxBuffer: 16 * 1024 * 1024,
          },
        )
        stdout = result.stdout
        stderr = result.stderr
      } catch (error) {
        const failure = error as { code?: unknown; stdout?: string; stderr?: string }
        code = typeof failure.code === "number" ? failure.code : 1
        stdout = failure.stdout ?? ""
        stderr = failure.stderr ?? "Scenario process failed"
      }
      await writeFile(resolve(output, `${scenario.name}-${repetition}.log`), stdout + stderr, { flag: "wx" })
      let result: unknown = null
      try {
        result = JSON.parse(await readFile(resolve(directory, "result.json"), "utf8"))
      } catch {
        /* Missing reports remain explicit attempts. */
      }
      results.push(result)
      const fields = result !== null && typeof result === "object" ? (result as Record<string, unknown>) : {}
      summary.attempts.push({
        scenario: scenario.name,
        repetition,
        commandCode: code,
        resultDirectory: directory,
        status: fields.status ?? "incomplete",
        sourceSha: fields.sourceSha ?? null,
        durationMs: performance.now() - started,
      })
      await save()
    }
    if (scenario.repetitions >= 5) {
      try {
        await writeFile(
          resolve(output, `${scenario.name}.calibration.json`),
          JSON.stringify(calibrateNoise(results), null, 2) + "\n",
          { flag: "wx" },
        )
      } catch (error) {
        await writeFile(resolve(output, `${scenario.name}.calibration-unavailable.txt`), String(error) + "\n", {
          flag: "wx",
        })
      }
    }
  }
  summary.finishedAt = new Date().toISOString()
  await save()
  return summary
}
