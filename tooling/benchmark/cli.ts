import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { createHash } from "node:crypto"
import { compareRuns, comparisonMarkdown, provisionalBudgets } from "./compare"

if (process.argv[2] === "replay") {
  const { benchmarkReplay } = await import("./replay")
  const args = process.argv.slice(3)
  for (let index = 0; index < args.length; index += 2)
    if (
      !["--output", "--image", "--source-image", "--format"].includes(args[index]) ||
      !args[index + 1] ||
      args[index + 1].startsWith("--")
    )
      throw new Error("Invalid replay benchmark argument")
  const output = args[args.indexOf("--output") + 1],
    image = args[args.indexOf("--image") + 1]
  if (!args.includes("--output") || !args.includes("--image")) throw new Error("replay requires --output and --image")
  const sourceImage = args.includes("--source-image") ? args[args.indexOf("--source-image") + 1] : image
  const format = args.includes("--format") ? args[args.indexOf("--format") + 1] : "scoped-json"
  if (format !== "native" && format !== "scoped-json" && format !== "legacy-json")
    throw new Error("Invalid replay format")
  const result = await benchmarkReplay(image, output, sourceImage, format)
  process.stdout.write(JSON.stringify({ output, status: result.status }) + "\n")
  process.exitCode = result.status === "passed" ? 0 : 1
} else if (process.argv[2] === "celery") {
  const { benchmarkCelery } = await import("./celery")
  const args = process.argv.slice(3)
  const allowed = new Set(["--output", "--image", "--repetitions"])
  for (let index = 0; index < args.length; index += 2)
    if (!allowed.has(args[index]) || !args[index + 1] || args[index + 1].startsWith("--"))
      throw new Error("Invalid Celery benchmark argument")
  const option = (name: string) => {
    const index = args.indexOf(name)
    return index < 0 ? undefined : args[index + 1]
  }
  const output = option("--output"),
    image = option("--image"),
    repetitions = Number(option("--repetitions") ?? "5")
  if (!output || !image) throw new Error("celery requires --output and --image")
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10)
    throw new Error("Celery repetitions must be between 1 and 10")
  const result = await benchmarkCelery(image, output, repetitions)
  process.stdout.write(JSON.stringify({ output, status: result.status }) + "\n")
  process.exitCode = result.status === "passed" ? 0 : 1
} else if (process.argv[2] === "failover") {
  const { benchmarkFailover } = await import("./failover")
  const args = process.argv.slice(3)
  const allowed = new Set(["--output", "--image", "--arrival-mode"])
  for (let index = 0; index < args.length; index += 2)
    if (!allowed.has(args[index]) || !args[index + 1] || args[index + 1].startsWith("--"))
      throw new Error("Invalid failover argument")
  const option = (name: string) => {
    const index = args.indexOf(name)
    return index < 0 ? undefined : args[index + 1]
  }
  const output = option("--output"),
    image = option("--image"),
    mode = option("--arrival-mode") ?? "after-takeover"
  if (!output || !image) throw new Error("failover requires --output and --image")
  if (mode !== "after-takeover" && mode !== "during-failure") throw new Error("Invalid arrival mode")
  const result = await benchmarkFailover(image, output, mode)
  process.stdout.write(JSON.stringify({ output, status: result.status }) + "\n")
  process.exitCode = result.status === "passed" ? 0 : 1
} else if (process.argv[2] === "pods") {
  const { benchmarkPods } = await import("./deployment")
  const args = process.argv.slice(3)
  const allowed = new Set(["--output", "--image", "--kind", "--image-cache", "--crane"])
  for (let index = 0; index < args.length; index += 2)
    if (!allowed.has(args[index]) || !args[index + 1] || args[index + 1].startsWith("--"))
      throw new Error("Invalid pods argument")
  const option = (name: string) => {
    const index = args.indexOf(name)
    return index < 0 ? undefined : args[index + 1]
  }
  const output = option("--output"),
    image = option("--image")
  if (!output || !image) throw new Error("pods requires --output and --image")
  const cache = option("--image-cache") ?? "cached"
  if (cache !== "cached" && cache !== "registry-cold") throw new Error("Invalid pod image-cache mode")
  const result = await benchmarkPods(image, output, option("--kind"), cache, option("--crane"))
  process.stdout.write(JSON.stringify({ output, status: result.status }) + "\n")
  process.exitCode = result.status === "passed" ? 0 : 1
} else if (process.argv[2] === "suite") {
  const { runSuite } = await import("./suite")
  const args = process.argv.slice(3)
  const allowed = new Set(["--manifest", "--output", "--image", "--expected-source-sha"])
  for (let index = 0; index < args.length; index += 2)
    if (!allowed.has(args[index]) || !args[index + 1] || args[index + 1].startsWith("--"))
      throw new Error("Invalid suite argument")
  const option = (name: string) => {
    const index = args.indexOf(name)
    return index < 0 ? undefined : args[index + 1]
  }
  const manifest = option("--manifest"),
    output = option("--output"),
    image = option("--image")
  if (!manifest || !output || !image) throw new Error("suite requires --manifest, --output and --image")
  const result = await runSuite(manifest, output, image, option("--expected-source-sha"))
  process.stdout.write(JSON.stringify({ output, attempts: result.attempts.length }) + "\n")
  process.exitCode = result.attempts.every((attempt) => {
    const item = attempt as { commandCode: number; status: string }
    return item.commandCode === 0 && item.status === "passed"
  })
    ? 0
    : 1
} else if (process.argv[2] === "calibrate") {
  const { calibrateNoise } = await import("./calibrate")
  const args = process.argv.slice(3)
  const output = args[0] === "--output" ? args[1] : undefined
  if (args[0] === "--output" && (!output || output.startsWith("--")))
    throw new Error("calibrate --output requires a new directory")
  const paths = output ? args.slice(2) : args
  const calibration = calibrateNoise(
    await Promise.all(paths.map(async (path) => JSON.parse(await readFile(path, "utf8")))),
  )
  if (output) {
    await mkdir(dirname(resolve(output)), { recursive: true })
    await mkdir(output)
    await writeFile(resolve(output, "calibration.json"), JSON.stringify(calibration, null, 2) + "\n", { flag: "wx" })
    await writeFile(resolve(output, "budgets.json"), JSON.stringify(calibration.budgets, null, 2) + "\n", {
      flag: "wx",
    })
  }
  process.stdout.write(JSON.stringify(calibration, null, 2) + "\n")
} else if (process.argv[2] !== "compare") {
  await import("./run")
} else {
  const args = process.argv.slice(3)
  const allowed = new Set(["--baseline", "--candidate", "--output", "--budgets"])
  for (let index = 0; index < args.length; index += 2)
    if (!allowed.has(args[index]) || !args[index + 1] || args[index + 1].startsWith("--"))
      throw new Error(`Invalid comparison argument: ${args[index]}`)
  const option = (name: string) => {
    const index = args.indexOf(name)
    return index < 0 ? undefined : args[index + 1]
  }
  const baseline = option("--baseline"),
    candidate = option("--candidate")
  if (!baseline || !candidate) throw new Error("bench compare requires --baseline and --candidate result.json paths")
  const budgets = option("--budgets")
  const comparison = compareRuns(
    JSON.parse(await readFile(baseline, "utf8")),
    JSON.parse(await readFile(candidate, "utf8")),
    budgets ? JSON.parse(await readFile(budgets, "utf8")) : provisionalBudgets,
  )
  const report = {
    ...comparison,
    comparator: {
      bunVersion: process.versions.bun,
      files: Object.fromEntries(
        await Promise.all(
          ["compare.ts", "cli.ts"].map(async (file) => [
            file,
            createHash("sha256")
              .update(await readFile(new URL(file, import.meta.url)))
              .digest("hex"),
          ]),
        ),
      ),
    },
  }
  const output = resolve(option("--output") ?? `test-results/benchmark/comparisons/${Date.now()}`)
  await mkdir(dirname(output), { recursive: true })
  await mkdir(output)
  await writeFile(resolve(output, "comparison.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" })
  await writeFile(resolve(output, "comparison.md"), comparisonMarkdown(report), { flag: "wx" })
  process.stdout.write(JSON.stringify({ output, status: report.status, flaggedCount: report.flaggedCount }) + "\n")
  process.exitCode = report.status === "report-only" ? 0 : report.status.startsWith("candidate-") ? 1 : 2
}
