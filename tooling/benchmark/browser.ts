import { chromium, type Page } from "../playwright"
import { resolve } from "node:path"
import { benchmarkAccount } from "./ingress"
import { CborCodec } from "surrealdb"

async function signInBenchmark(page: import("../playwright").Page, url: string) {
  await page.goto(`${url}/login`)
  await page.getByLabel("Username", { exact: true }).fill(benchmarkAccount.username)
  await page.getByLabel("Password", { exact: true }).fill(benchmarkAccount.password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL(`${url}/`)
}

type Entry = {
  name: string
  entryType: string
  startTime: number
  duration: number
  value?: number
  interactionId?: number
  hadRecentInput?: boolean
}
type BrowserMetrics = { entries: Entry[]; observers: PerformanceObserver[]; supported: readonly string[] }

export function layoutShiftScore(entries: Entry[]) {
  let score = 0
  let session = 0
  let start = 0
  let previous = 0
  for (const entry of entries
    .filter((entry) => entry.entryType === "layout-shift" && !entry.hadRecentInput)
    .sort((a, b) => a.startTime - b.startTime)) {
    if (session === 0 || entry.startTime - previous >= 1000 || entry.startTime - start >= 5000) {
      session = 0
      start = entry.startTime
    }
    session += entry.value ?? 0
    score = Math.max(score, session)
    previous = entry.startTime
  }
  return score
}

export async function benchmarkLiveBrowser<T>(
  url: string,
  tasks: number,
  produce: () => Promise<T>,
  completionTimeoutMs = 60_000,
) {
  const browser = await chromium.launch()
  let production: Promise<T> | undefined
  const errors: string[] = []
  const measurements: Record<string, unknown> = {
    status: "incomplete",
    version: browser.version(),
    profile: {
      viewport: { width: 1440, height: 900 },
      cache: "fresh-context",
      network: "unthrottled",
      query: "bench-",
    },
    firstObservedTask: null,
    finalTask: `bench-${tasks - 1}`,
    errors,
    limitations: [
      "Launch-to-paint includes producer container startup, backend warmup, ingestion and the Explorer refresh interval; it is not publish-to-paint latency.",
      "One measured browser with active ingestion; no fan-out, field INP or reconnect claim.",
      "The final task/result oracle validates browser convergence; independent producer validation checks full history and workflow/result correctness.",
    ],
  }
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true })
    await signInBenchmark(page, url)
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(`${url}/explorer`, { waitUntil: "domcontentloaded" })
    await page.getByPlaceholder("Search tasks, workers, errors…").fill("bench-")
    // Historical IDs have a different prefix. Await the real empty query result
    // before publication so cached history/skeletons cannot satisfy readiness.
    await page.getByText("No tasks found.", { exact: true }).waitFor({ timeout: 30_000 })
    const paint = () =>
      page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))))
    const launch = performance.now()
    production = produce()
    // Attach rejection immediately while browser observation is in progress.
    void production.catch(() => {})
    const first = page.locator("table tbody tr a[href*='/tasks/bench-']").first()
    await first.waitFor({ state: "visible", timeout: 60_000 })
    await paint()
    const firstHref = await first.getAttribute("href")
    const firstId = Number(firstHref?.match(/\/tasks\/bench-(\d+)$/)?.[1])
    if (!Number.isInteger(firstId) || firstId < 0 || firstId >= tasks)
      throw new Error("Live row is outside the expected task fixture")
    measurements.firstObservedTask = `bench-${firstId}`
    measurements.producerLaunchToFirstRowsMs = performance.now() - launch
    const interaction = performance.now()
    const search = page.getByPlaceholder("Search tasks, workers, errors…")
    await search.fill(`bench-${firstId}`)
    if ((await search.inputValue()) !== `bench-${firstId}`) throw new Error("Live search input differs from fixture")
    const observed = page.locator(`table tbody tr a[href$='/tasks/bench-${firstId}']`).first()
    await observed.waitFor({ state: "visible", timeout: 60_000 })
    await paint()
    measurements.searchToObservedRowsMs = performance.now() - interaction
    const observedNavigation = performance.now()
    await observed.click()
    await page.waitForURL(`**/tasks/bench-${firstId}`)
    await page.waitForFunction(
      (expected) => document.body.innerText.includes(expected),
      `benchmark-result-${firstId}`,
      { timeout: 60_000 },
    )
    await paint()
    measurements.navigationToObservedResultMs = performance.now() - observedNavigation
    await page.goBack({ waitUntil: "domcontentloaded" })
    await search.waitFor({ timeout: 30_000 })
    await search.fill(`bench-${tasks - 1}`)
    const final = page.locator(`table tbody tr a[href$='/tasks/bench-${tasks - 1}']`).first()
    await final.waitFor({ state: "visible", timeout: completionTimeoutMs })
    await paint()
    measurements.producerLaunchToFinalRowsMs = performance.now() - launch
    const navigation = performance.now()
    await final.click()
    await page.waitForURL(`**/tasks/bench-${tasks - 1}`)
    await page.waitForFunction(
      (expected) => document.body.innerText.includes(expected),
      `benchmark-result-${tasks - 1}`,
      { timeout: 60_000 },
    )
    await paint()
    measurements.navigationToFinalResultMs = performance.now() - navigation
    measurements.status = errors.length ? "failed" : "passed"
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
    measurements.status = "failed"
  } finally {
    await browser.close()
  }
  // Observe the producer outcome even after browser failure; retain its independent
  // correctness evidence and avoid cleanup racing an unfinished producer.
  const result = production ? await production : await produce()
  return { production: result, browser: measurements }
}

export async function benchmarkBrowser(
  url: string,
  profile: "desktop" | "constrained" = "desktop",
  diagnosticsDirectory?: string,
) {
  const measurementProfile = {
    viewport: { width: 1440, height: 900 },
    device: "desktop",
    name: profile,
    network:
      profile === "constrained"
        ? { latencyMs: 150, downloadBitsPerSecond: 1_600_000, uploadBitsPerSecond: 750_000 }
        : "unthrottled",
    cpuThrottleRate: profile === "constrained" ? 4 : 1,
    initialCache: "fresh-context",
  }
  const browser = await chromium.launch()
  let phase = "sign-in"
  let diagnosticPage: Page | undefined
  let selectedTaskHref: string | null = null
  const errors: string[] = []
  const completed: Record<string, unknown> = {}
  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 900 },
    })
    await context.addInitScript(() => {
      const metrics = {
        entries: [],
        observers: [],
        supported: PerformanceObserver.supportedEntryTypes,
      } as BrowserMetrics
      const add = (entries: PerformanceEntry[]) => {
        for (const raw of entries) {
          const entry = raw as PerformanceEntry & { value?: number; interactionId?: number; hadRecentInput?: boolean }
          metrics.entries.push({
            name: entry.name,
            entryType: entry.entryType,
            startTime: entry.startTime,
            duration: entry.duration,
            value: entry.value,
            interactionId: entry.interactionId,
            hadRecentInput: entry.hadRecentInput,
          })
        }
      }
      for (const type of ["largest-contentful-paint", "layout-shift", "event", "longtask"]) {
        if (!metrics.supported.includes(type)) continue
        const observer = new PerformanceObserver((list) => add(list.getEntries()))
        observer.observe({ type, buffered: true, ...(type === "event" ? { durationThreshold: 16 } : {}) })
        metrics.observers.push(observer)
      }
      ;(window as unknown as { __benchmarkMetrics: BrowserMetrics }).__benchmarkMetrics = metrics
    })
    const page = await context.newPage()
    diagnosticPage = page
    const signInStarted = performance.now()
    await signInBenchmark(page, url)
    completed.signInMs = performance.now() - signInStarted
    const session = await context.newCDPSession(page)
    await session.send("Network.enable")
    phase = "initial-navigation"
    const sentPayloads: { phase: string; opcode: number; payloadData: string }[] = []
    const socketTraffic: Record<
      string,
      { sentFrames: number; receivedFrames: number; sentPayloadBytes: number; receivedPayloadBytes: number }
    > = {}
    const observeFrame = (direction: "sent" | "received", response: { opcode: number; payloadData: string }) => {
      // CDP exposes binary payloads as base64 and text frames as UTF-8. Control
      // frames are excluded; these are protocol traffic counts, not query counts.
      if (response.opcode !== 1 && response.opcode !== 2) return
      if (direction === "sent") sentPayloads.push({ phase, ...response })
      const traffic = (socketTraffic[phase] ??= {
        sentFrames: 0,
        receivedFrames: 0,
        sentPayloadBytes: 0,
        receivedPayloadBytes: 0,
      })
      traffic[direction === "sent" ? "sentFrames" : "receivedFrames"]++
      traffic[direction === "sent" ? "sentPayloadBytes" : "receivedPayloadBytes"] += Buffer.byteLength(
        response.payloadData,
        response.opcode === 2 ? "base64" : "utf8",
      )
    }
    session.on("Network.webSocketFrameSent", ({ response }) => observeFrame("sent", response))
    session.on("Network.webSocketFrameReceived", ({ response }) => observeFrame("received", response))
    if (profile === "constrained") {
      await session.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: 1_600_000 / 8,
        uploadThroughput: 750_000 / 8,
      })
      await session.send("Emulation.setCPUThrottlingRate", { rate: 4 })
    }
    page.on("pageerror", (error) => errors.push(error.message))
    page.on("response", (response) => {
      if (response.status() >= 400) errors.push(`${response.url()}: HTTP ${response.status()}`)
    })
    page.on("requestfailed", (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`))
    const capture = async () =>
      page.evaluate(() => {
        const metrics = (window as unknown as { __benchmarkMetrics: BrowserMetrics }).__benchmarkMetrics
        for (const observer of metrics.observers) {
          for (const raw of observer.takeRecords()) {
            const entry = raw as PerformanceEntry & { value?: number; interactionId?: number; hadRecentInput?: boolean }
            metrics.entries.push({
              name: entry.name,
              entryType: entry.entryType,
              startTime: entry.startTime,
              duration: entry.duration,
              value: entry.value,
              interactionId: entry.interactionId,
              hadRecentInput: entry.hadRecentInput,
            })
          }
        }
        return {
          supported: metrics.supported,
          entries: metrics.entries,
          navigation: performance.getEntriesByType("navigation").map((entry) => entry.toJSON()),
          paint: performance.getEntriesByType("paint").map((entry) => entry.toJSON()),
          resources: performance.getEntriesByType("resource").map((entry) => entry.toJSON()),
        }
      })
    const painted = () =>
      page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
      )
    const firstTask = page.locator("table tbody tr a[href*='/tasks/']").first()
    const started = performance.now()
    await page.goto(`${url}/explorer`, { waitUntil: "domcontentloaded" })
    await firstTask.waitFor({ state: "visible", timeout: 30_000 })
    await painted()
    const explorerUsefulDataMs = performance.now() - started
    const initial = await capture()
    completed.explorerUsefulDataMs = explorerUsefulDataMs
    const search = page.getByPlaceholder("Search tasks, workers, errors…")
    phase = "search-typing"
    const searchStart = performance.now()
    const typedSearch = "benchmark-no-such-task"
    await search.pressSequentially(typedSearch, { delay: 10 })
    const typedSearchObserved = await search.inputValue()
    if (typedSearchObserved !== typedSearch)
      errors.push(
        `Search lost input: expected ${JSON.stringify(typedSearch)}, observed ${JSON.stringify(typedSearchObserved)}`,
      )
    await page.getByText("No tasks found.", { exact: true }).waitFor({ timeout: 30_000 })
    await painted()
    const searchNoMatchMs = performance.now() - searchStart
    phase = "search-reset-after-typing"
    const resetStart = performance.now()
    await search.fill("")
    await firstTask.waitFor({ state: "visible", timeout: 30_000 })
    await painted()
    const searchResetMs = performance.now() - resetStart
    phase = "search-paste"
    const pasteStart = performance.now()
    // A distinct uncached key avoids React Query returning the typed search's
    // cached result. Both terms are guaranteed absent from the fixture.
    await search.fill("benchmark-no-paste-task")
    await page.getByText("No tasks found.", { exact: true }).waitFor({ timeout: 30_000 })
    await painted()
    const searchPasteNoMatchMs = performance.now() - pasteStart
    phase = "search-reset-after-paste"
    const pasteResetStart = performance.now()
    await search.fill("")
    await firstTask.waitFor({ state: "visible", timeout: 30_000 })
    await painted()
    const searchPasteResetMs = performance.now() - pasteResetStart
    const href = await firstTask.getAttribute("href")
    selectedTaskHref = href
    const task = href?.split("/tasks/bench-")[1]?.split("?")[0]
    if (!task) throw new Error(`Unexpected benchmark task link: ${href}`)
    phase = "task-navigation"
    const navigationStart = performance.now()
    // A refetch can reorder rows after reading href. Bind the click to that exact task.
    await page
      .locator(`table tbody tr a[href=${JSON.stringify(href)}]`)
      .first()
      .click()
    await page.waitForURL((destination) => destination.pathname === new URL(href!, url).pathname)
    await page.getByText("benchmark.work", { exact: true }).first().waitFor({ state: "visible", timeout: 30_000 })
    await page.waitForFunction((id) => document.body.innerText.includes(`benchmark-result-${id}`), task)
    await painted()
    const taskNavigationUsefulDataMs = performance.now() - navigationStart
    const final = await capture()
    // Decode outgoing requests after timing. Keep query identity/bindings without
    // retaining full SQL or adding decoding work to the measured interaction.
    const socketRequests = sentPayloads.map(({ phase, opcode, payloadData }) => {
      try {
        const request = (
          opcode === 2 ? CborCodec.DEFAULT.decode(Buffer.from(payloadData, "base64")) : JSON.parse(payloadData)
        ) as { method?: string; params?: unknown[] }
        const sql = request.method === "query" ? request.params?.[0] : null
        return {
          phase,
          method: request.method ?? null,
          explorerQuery:
            sql === "observation:read" &&
            (request.params?.[1] as { request?: { operation?: string } })?.request?.operation === "explorer",
          bindings: request.method === "query" ? request.params?.[1] : null,
          decodeError: null,
        }
      } catch (error) {
        return { phase, method: null, explorerQuery: null, bindings: null, decodeError: String(error) }
      }
    })
    const assets = final.resources.filter((entry) => /\/assets\/.*\.(js|css|wasm)(?:\?|$)/.test(String(entry.name)))
    const interactions = new Map<number, number>()
    for (const entry of final.entries)
      if (entry.interactionId) {
        interactions.set(entry.interactionId, Math.max(interactions.get(entry.interactionId) ?? 0, entry.duration))
      }
    return {
      status: errors.length ? "failed" : "passed",
      version: browser.version(),
      profile: measurementProfile,
      explorerUsefulDataMs,
      searchNoMatchMs,
      typedSearch: { expected: typedSearch, observed: typedSearchObserved },
      searchResetMs,
      searchPasteNoMatchMs,
      searchPasteResetMs,
      socketTraffic,
      socketRequests,
      taskNavigationUsefulDataMs,
      initialDocument: {
        ttfbMs: initial.navigation[0]
          ? Number(initial.navigation[0].responseStart) - Number(initial.navigation[0].startTime)
          : null,
        fcpMs: initial.paint.find((entry) => entry.name === "first-contentful-paint")?.startTime ?? null,
        lcpAtUsefulRowsMs:
          initial.entries.filter((entry) => entry.entryType === "largest-contentful-paint").at(-1)?.startTime ?? null,
        clsAtUsefulRows: initial.supported.includes("layout-shift") ? layoutShiftScore(initial.entries) : null,
      },
      journey: {
        cls: final.supported.includes("layout-shift") ? layoutShiftScore(final.entries) : null,
        recordedInteractionCount: final.supported.includes("event") ? interactions.size : null,
        maximumRecordedInteractionDurationMs: interactions.size ? Math.max(...interactions.values()) : null,
        longTaskCount: final.supported.includes("longtask")
          ? final.entries.filter((entry) => entry.entryType === "longtask").length
          : null,
        longTaskDurationMs: final.supported.includes("longtask")
          ? final.entries
              .filter((entry) => entry.entryType === "longtask")
              .reduce((total, entry) => total + entry.duration, 0)
          : null,
        assetTransferBytes: assets.reduce((total, entry) => total + Number(entry.transferSize), 0),
        assetEncodedBodyBytes: assets.reduce((total, entry) => total + Number(entry.encodedBodySize), 0),
        assetDecodedBodyBytes: assets.reduce((total, entry) => total + Number(entry.decodedBodySize), 0),
      },
      errors,
      raw: { initial, final },
      limitations: [
        "One laboratory journey after ingestion on the declared fixture; no live-rendering or field-vitals claim.",
        "Typing uses 10ms between characters; paste uses a distinct absent term to avoid reusing the typed query cache. Their order is fixed and database caches are warm.",
        "WebSocket frame counts include all data protocol traffic during each phase, including background work; they are not decoded query counts.",
        "LCP is sampled at useful rows; SPA navigation has its own data-and-result paint milestone.",
        "Interaction duration is a laboratory observation, not field INP. Sub-16ms events may be absent.",
        "Resource Timing covers fetched assets; WebSocket data, unfetched lazy chunks, and whole-build bundle sizes are separate.",
      ],
    }
  } catch (error) {
    let screenshot: string | null = null
    if (diagnosticPage && diagnosticsDirectory) {
      screenshot = resolve(diagnosticsDirectory, "browser-failure.png")
      try {
        await diagnosticPage.screenshot({ path: screenshot })
      } catch {
        screenshot = null
      }
    }
    let bodyPreview: string | null = null
    try {
      bodyPreview = (await diagnosticPage?.locator("body").innerText())?.slice(0, 4000) ?? null
    } catch {
      /* Retain the original failure. */
    }
    return {
      status: "failed",
      version: browser.version(),
      profile: measurementProfile,
      failedPhase: phase,
      error: String(error),
      currentUrl: diagnosticPage?.url() ?? null,
      selectedTaskHref,
      screenshot,
      bodyPreview,
      completed,
      errors,
      limitations: ["Incomplete journey; partial successful measurements are diagnostic, not a passing baseline."],
    }
  } finally {
    await browser.close()
  }
}
