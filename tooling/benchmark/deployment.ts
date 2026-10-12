import { execFile, spawn } from "node:child_process"
import { promisify } from "node:util"
import { randomUUID, createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"
import { benchmarkBrowser } from "./browser"

const execute = promisify(execFile)
const nodeImage = "kindest/node:v1.37.0@sha256:a1ed56cfb0e7b93589bdf97c8cd566405a265939e3620fc4f5de89adff580ae5"
const readiness = `import asyncio
from surrealdb import AsyncSurreal
async def check():
    db=AsyncSurreal('ws://127.0.0.1:8555/surreal/rpc')
    try:
        await db.signin({'namespace':'celery_insights','database':'main','username':'viewer','password':'viewer'})
        await db.use('celery_insights','main')
        result=await db.query_raw('RETURN true')
        assert result['result'][0]['status']=='OK' and result['result'][0]['result'] is True
    finally:
        await db.close()
asyncio.run(check())`
const namespace = "benchmark"
const env = (values: Record<string, string>) => Object.entries(values).map(([name, value]) => ({ name, value }))
export function applicationPod(name: string, image: string, architecture: string, imagePullPolicy = "Never") {
  return {
    apiVersion: "v1",
    kind: "Pod",
    metadata: { name, namespace, labels: { app: "insights" } },
    spec: {
      nodeSelector: { "kubernetes.io/arch": architecture },
      restartPolicy: "Never",
      terminationGracePeriodSeconds: 30,
      initContainers: [
        {
          name: "prepare-store",
          image,
          imagePullPolicy,
          command: ["sh", "-c", "chown myuser:myuser /data"],
          securityContext: { runAsUser: 0 },
          volumeMounts: [{ name: "data", mountPath: "/data" }],
        },
      ],
      containers: [
        {
          name: "app",
          image,
          imagePullPolicy,
          ports: [{ containerPort: 8555 }],
          resources: { requests: { cpu: "1", memory: "1Gi" }, limits: { cpu: "1", memory: "1Gi" } },
          env: env({
            BROKER_URL: "amqp://benchmark:benchmark@broker/",
            RESULT_BACKEND: "redis://results:6379/0",
            SURREALDB_STORAGE: "rocksdb:///data/store",
            SURREALDB_INGESTER_PASS: "benchmark-ingester",
            SEARCH_INDEXING_ENABLED: "false",
            LOG_FORMAT: "json",
          }),
          readinessProbe: {
            exec: { command: ["python", "-c", readiness] },
            periodSeconds: 1,
            timeoutSeconds: 5,
            failureThreshold: 120,
          },
          volumeMounts: [{ name: "data", mountPath: "/data" }],
        },
      ],
      volumes: [
        { name: "data", hostPath: { path: "/var/local/celery-insights-benchmark", type: "DirectoryOrCreate" } },
      ],
    },
  }
}

export function podMilestones(pod: Record<string, any>) {
  const created = Date.parse(pod.metadata?.creationTimestamp)
  const transition = (type: string) =>
    pod.status?.conditions?.find(
      (condition: { type: string; status: string }) => condition.type === type && condition.status === "True",
    )?.lastTransitionTime
  const delta = (time: unknown) =>
    typeof time === "string" && Number.isFinite(created) && Number.isFinite(Date.parse(time))
      ? Date.parse(time) - created
      : null
  return {
    uid: pod.metadata?.uid,
    createdAt: pod.metadata?.creationTimestamp,
    scheduledMs: delta(transition("PodScheduled")),
    containerStartedMs: delta(pod.status?.containerStatuses?.[0]?.state?.running?.startedAt),
    storeInitStartedMs: delta(pod.status?.initContainerStatuses?.[0]?.state?.terminated?.startedAt),
    storeInitFinishedMs: delta(pod.status?.initContainerStatuses?.[0]?.state?.terminated?.finishedAt),
    dataProbeReadyMs: delta(transition("Ready")),
    imageId: pod.status?.containerStatuses?.[0]?.imageID ?? null,
    restartCount: pod.status?.containerStatuses?.[0]?.restartCount ?? null,
  }
}

export async function benchmarkPods(
  image: string,
  output: string,
  kind = "kind",
  imageCache: "cached" | "registry-cold" = "cached",
  crane = "crane",
) {
  await mkdir(dirname(resolve(output)), { recursive: true })
  await mkdir(output)
  const temporary = await mkdtemp(resolve(tmpdir(), "benchmark-kubernetes-"))
  const kubeconfig = resolve(temporary, "config")
  const cluster = `ci-bench-${randomUUID().slice(0, 8)}`
  const report: Record<string, unknown> = {
    schemaVersion: 1,
    status: "incomplete",
    cluster,
    startedAt: new Date().toISOString(),
    nodeImage,
    imageCache,
    cases: [],
    limitations: [
      "A disposable single-node native kind cluster; cloud scheduling/storage/network and multi-node topology are separate scenarios.",
      imageCache === "cached"
        ? "App images are imported from the host. Import time is separate; pod cases use cached images, with empty and retained stores."
        : "The initial app image is absent from the fresh node and pulled from a disposable local registry. This measures local transfer/unpack, not Internet/cloud registry latency. Retained-store replacement uses its resulting cache.",
      "Readiness performs a real viewer query through Bun. Cold ingestion and warm persisted-data correctness use an independent producer/validator.",
      "Kubernetes timestamps have limited resolution; readiness is observed by a one-second probe. Controller timing includes kubectl and producer scheduling.",
    ],
  }
  const commands: unknown[] = []
  const run = async (file: string, args: string[], timeout = 180_000) => {
    const started = performance.now()
    try {
      const result = await execute(file, args, {
        timeout,
        maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env, KUBECONFIG: kubeconfig, KIND_EXPERIMENTAL_PROVIDER: "docker" },
      })
      commands.push({ file, args, durationMs: performance.now() - started, code: 0 })
      return result.stdout
    } catch (error) {
      const failure = error as { stdout?: string; stderr?: string; code?: unknown }
      commands.push({ file, args, durationMs: performance.now() - started, code: failure.code, stderr: failure.stderr })
      throw new Error(`${file} ${args[0]} failed: ${failure.stderr ?? "command failure"}`)
    }
  }
  const kubectl = (...args: string[]) =>
    run("kubectl", ["--kubeconfig", kubeconfig, "--context", `kind-${cluster}`, ...args])
  const apply = async (name: string, items: unknown[]) => {
    const path = resolve(output, `${name}.json`)
    await writeFile(path, JSON.stringify({ apiVersion: "v1", kind: "List", items }, null, 2))
    await kubectl("apply", "-f", path)
  }
  let created = false
  const registry = `ci-registry-${randomUUID()}`
  let registryCreated = false
  let forward: ReturnType<typeof spawn> | undefined
  try {
    report.kindVersion = (await run(kind, ["version"])).trim()
    report.sourceSha = (await run("git", ["rev-parse", "HEAD"])).trim()
    report.sourceStatus = await run("git", ["status", "--porcelain"])
    const inspection = JSON.parse(await run("docker", ["image", "inspect", image]))[0]
    report.image = {
      reference: image,
      id: inspection.Id,
      architecture: inspection.Architecture,
      unpackedBytes: inspection.Size,
    }
    const pipeline = await readFile(new URL("pipeline.py", import.meta.url), "utf8")
    report.pipelineSha256 = createHash("sha256").update(pipeline).digest("hex")
    report.harness = {
      bunVersion: process.versions.bun,
      files: Object.fromEntries(
        await Promise.all(
          ["deployment.ts", "browser.ts", "pipeline.py"].map(async (file) => [
            file,
            createHash("sha256")
              .update(await readFile(new URL(file, import.meta.url)))
              .digest("hex"),
          ]),
        ),
      ),
    }
    created = true
    const setup = performance.now()
    await run(
      kind,
      ["create", "cluster", "--name", cluster, "--kubeconfig", kubeconfig, "--image", nodeImage, "--wait", "120s"],
      600_000,
    )
    report.clusterSetupMs = performance.now() - setup
    const imported = performance.now()
    // Docker's containerd store can retain a multi-platform index without all
    // child blobs. Export only the measured native platform before kind import.
    const archive = resolve(temporary, "images.tar")
    await run(
      "docker",
      [
        "image",
        "save",
        "--platform",
        `linux/${inspection.Architecture}`,
        "--output",
        archive,
        ...(imageCache === "cached" ? [image] : []),
        "rabbitmq:4.3.6-management-alpine",
        "redis:8.10.2-alpine",
      ],
      600_000,
    )
    await run(kind, ["load", "image-archive", "--name", cluster, archive], 600_000)
    report.cachedImageImportMs = performance.now() - imported
    let podImage = image
    if (imageCache === "registry-cold") {
      const registrySetup = performance.now()
      registryCreated = true
      await run("docker", ["run", "-d", "--rm", "--name", registry, "-p", "127.0.0.1::5000", "registry:3.0.0"])
      const binding = JSON.parse(await run("docker", ["inspect", registry]))[0].NetworkSettings.Ports["5000/tcp"][0]
      const registryDeadline = performance.now() + 20_000
      while (true) {
        try {
          if ((await fetch(`http://127.0.0.1:${binding.HostPort}/v2/`, { signal: AbortSignal.timeout(1000) })).ok) break
        } catch {
          /* Container creation precedes HTTP readiness. */
        }
        if (performance.now() > registryDeadline) throw new Error("Private registry readiness deadline exceeded")
        await new Promise((done) => setTimeout(done, 250))
      }
      // Docker Desktop can resolve localhost to an unbound IPv6 loopback.
      const registryAddress = `127.0.0.1:${binding.HostPort}`
      const registryReference = `${registryAddress}/benchmark/app:trial`
      const appArchive = resolve(temporary, "app.tar")
      await run(
        "docker",
        ["image", "save", "--platform", `linux/${inspection.Architecture}`, "--output", appArchive, image],
        600_000,
      )
      report.craneVersion = (await run(crane, ["version"])).trim()
      await run(crane, ["push", "--insecure", appArchive, registryReference], 600_000)
      const digest = (await run(crane, ["digest", "--insecure", registryReference])).trim()
      if (!/^sha256:[0-9a-f]{64}$/.test(digest)) throw new Error("Private registry push returned no immutable digest")
      podImage = `${registryAddress}/benchmark/app@${digest}`
      const nodes = (await run(kind, ["get", "nodes", "--name", cluster])).trim().split("\n")
      if (nodes.length !== 1) throw new Error("Registry-cold case requires one owned kind node")
      const registryDirectory = `/etc/containerd/certs.d/${registryAddress}`
      const hosts = resolve(temporary, "hosts.toml")
      await writeFile(hosts, `[host."http://${registry}:5000"]\n`)
      await run("docker", ["exec", nodes[0], "mkdir", "-p", registryDirectory])
      await run("docker", ["cp", hosts, `${nodes[0]}:${registryDirectory}/hosts.toml`])
      await run("docker", ["network", "connect", "kind", registry])
      const inventory = JSON.parse(await run("docker", ["exec", nodes[0], "crictl", "images", "--output", "json"]))
      if (inventory.images.some((item: { id: string }) => item.id === inspection.Id))
        throw new Error("Cold-node application image was unexpectedly already cached")
      await writeFile(resolve(output, "cold-node-images.json"), JSON.stringify(inventory, null, 2))
      const manifestResponse = await fetch(
        `http://127.0.0.1:${binding.HostPort}/v2/benchmark/app/manifests/${digest}`,
        {
          headers: {
            Accept: "application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json",
          },
          signal: AbortSignal.timeout(10_000),
        },
      )
      if (!manifestResponse.ok) throw new Error("Could not inspect private registry layer manifest")
      const manifest = (await manifestResponse.json()) as { layers?: { digest: string; size: number }[] }
      if (!Array.isArray(manifest.layers)) throw new Error("Private registry did not return a native layer manifest")
      const content = new Set(
        (await run("docker", ["exec", nodes[0], "ctr", "-n", "k8s.io", "content", "ls", "-q"])).trim().split(/\s+/),
      )
      await writeFile(resolve(output, "registry-manifest.json"), JSON.stringify(manifest, null, 2))
      report.localRegistry = {
        image: podImage,
        setupAndPushMs: performance.now() - registrySetup,
        appImageAbsentBeforePod: true,
        layers: manifest.layers.map((layer) => ({ ...layer, cachedBeforePod: content.has(layer.digest) })),
      }
    }
    report.nodes = JSON.parse(await kubectl("get", "nodes", "-o", "json"))
    await kubectl("create", "namespace", namespace)
    const pod = (name: string, containerImage: string, port: number, values: Record<string, string>) => ({
      apiVersion: "v1",
      kind: "Pod",
      metadata: { name, namespace, labels: { app: name } },
      spec: {
        containers: [
          {
            name,
            image: containerImage,
            imagePullPolicy: "Never",
            env: env(values),
            ports: [{ containerPort: port }],
            readinessProbe: { tcpSocket: { port }, periodSeconds: 1 },
            resources: {
              requests: { cpu: "100m", memory: name === "broker" ? "512Mi" : "64Mi" },
              limits: { cpu: "1", memory: name === "broker" ? "512Mi" : "128Mi" },
            },
          },
        ],
      },
    })
    const service = (name: string, app: string, port: number) => ({
      apiVersion: "v1",
      kind: "Service",
      metadata: { name, namespace },
      spec: { selector: { app }, ports: [{ port, targetPort: port }] },
    })
    await apply("dependencies", [
      pod("broker", "rabbitmq:4.3.6-management-alpine", 5672, {
        RABBITMQ_DEFAULT_USER: "benchmark",
        RABBITMQ_DEFAULT_PASS: "benchmark",
      }),
      pod("results", "redis:8.10.2-alpine", 6379, {}),
      service("broker", "broker", 5672),
      service("results", "results", 6379),
      service("app", "insights", 8555),
      {
        apiVersion: "v1",
        kind: "ConfigMap",
        metadata: { name: "producer", namespace },
        data: { "pipeline.py": pipeline },
      },
    ])
    await kubectl(
      "wait",
      "--namespace",
      namespace,
      "--for=condition=Ready",
      "pod/broker",
      "pod/results",
      "--timeout=120s",
    )
    const produce = async (name: string, validateOnly: boolean) => {
      await apply(name, [
        {
          apiVersion: "v1",
          kind: "Pod",
          metadata: { name, namespace },
          spec: {
            restartPolicy: "Never",
            containers: [
              {
                name: "producer",
                image: podImage,
                imagePullPolicy: imageCache === "cached" ? "Never" : "IfNotPresent",
                command: [
                  "python",
                  "/benchmark/pipeline.py",
                  "--tasks",
                  "32",
                  "--rate",
                  "100",
                  ...(validateOnly ? ["--validate-only"] : []),
                ],
                env: env({
                  BROKER_URL: "amqp://benchmark:benchmark@broker/",
                  RESULT_BACKEND: "redis://results:6379/0",
                  BENCH_DB_URL: "ws://app:8555/surreal/rpc",
                }),
                volumeMounts: [{ name: "script", mountPath: "/benchmark", readOnly: true }],
              },
            ],
            volumes: [{ name: "script", configMap: { name: "producer" } }],
          },
        },
      ])
      const deadline = performance.now() + 90_000
      while (true) {
        const state = JSON.parse(await kubectl("get", "pod", name, "--namespace", namespace, "-o", "json"))
        if (["Succeeded", "Failed"].includes(state.status?.phase)) {
          const logs = await kubectl("logs", name, "--namespace", namespace)
          await writeFile(resolve(output, `${name}.log`), logs)
          return JSON.parse(logs.trim().split("\n").at(-1) ?? "null")
        }
        if (performance.now() > deadline) throw new Error("Producer/validator pod deadline exceeded")
        await new Promise((done) => setTimeout(done, 500))
      }
    }
    for (const name of ["cold", "warm"]) {
      const start = performance.now()
      await apply(`app-${name}`, [
        applicationPod(
          `app-${name}`,
          podImage,
          inspection.Architecture,
          imageCache === "cached" ? "Never" : "IfNotPresent",
        ),
      ])
      await kubectl("wait", "--namespace", namespace, "--for=condition=Ready", `pod/app-${name}`, "--timeout=120s")
      const state = JSON.parse(await kubectl("get", "pod", `app-${name}`, "--namespace", namespace, "-o", "json"))
      const validation = await produce(`producer-${name}`, name === "warm")
      ;(report.cases as unknown[]).push({
        name: `${imageCache === "registry-cold" && name === "cold" ? "registry-cold-image" : "cached-image"}-${name === "cold" ? "empty" : "retained"}-store`,
        ...podMilestones(state),
        applyToValidatedDataMs: performance.now() - start,
        validation,
      })
      await writeFile(
        resolve(output, `app-${name}.log`),
        await kubectl("logs", `app-${name}`, "--namespace", namespace),
      )
      if (name === "cold") {
        const stop = performance.now()
        await kubectl("delete", "pod", "app-cold", "--namespace", namespace, "--wait=true")
        report.coldPodShutdownMs = performance.now() - stop
      }
    }
    forward = spawn(
      "kubectl",
      [
        "--kubeconfig",
        kubeconfig,
        "--context",
        `kind-${cluster}`,
        "--namespace",
        namespace,
        "port-forward",
        "pod/app-warm",
        ":8555",
        "--address",
        "127.0.0.1",
      ],
      { env: { ...process.env, KUBECONFIG: kubeconfig } },
    )
    const address = await new Promise<string>((done, reject) => {
      const timeout = setTimeout(() => reject(new Error("Port-forward readiness deadline exceeded")), 10_000)
      forward!.once("error", (error) => {
        clearTimeout(timeout)
        reject(error)
      })
      forward!.stdout!.on("data", (data) => {
        const match = String(data).match(/Forwarding from 127\.0\.0\.1:(\d+)/)
        if (match) {
          clearTimeout(timeout)
          done(`http://127.0.0.1:${match[1]}`)
        }
      })
    })
    report.browser = await benchmarkBrowser(address)
    report.status =
      (report.cases as { validation: { status: string } }[]).every((item) => item.validation.status === "passed") &&
      (report.browser as { status: string }).status === "passed"
        ? "passed"
        : "failed"
  } catch (error) {
    report.status = "incomplete"
    report.error = String(error)
  } finally {
    forward?.kill()
    if (created) {
      for (const name of ["app-cold", "app-warm", "producer-cold", "producer-warm"]) {
        try {
          await writeFile(
            resolve(output, `${name}-final.json`),
            await kubectl("get", "pod", name, "--namespace", namespace, "-o", "json"),
          )
          await writeFile(resolve(output, `${name}.log`), await kubectl("logs", name, "--namespace", namespace))
        } catch {
          /* A setup failure may precede creation of this pod. */
        }
      }
      try {
        await writeFile(
          resolve(output, "events.json"),
          await kubectl("get", "events", "--namespace", namespace, "-o", "json"),
        )
      } catch {
        /* Cluster creation may have failed before the namespace exists. */
      }
      try {
        await run(kind, ["delete", "cluster", "--name", cluster, "--kubeconfig", kubeconfig])
        report.cleanedUp = true
      } catch (error) {
        report.cleanedUp = false
        report.cleanupError = String(error)
        report.status = "incomplete"
      }
    }
    if (registryCreated) {
      try {
        await run("docker", ["stop", registry])
        report.registryCleanedUp = true
      } catch (error) {
        report.registryCleanedUp = false
        report.registryCleanupError = String(error)
        report.status = "incomplete"
      }
    }
    await rm(temporary, { recursive: true, force: true })
    report.finishedAt = new Date().toISOString()
    await writeFile(resolve(output, "commands.json"), JSON.stringify(commands, null, 2))
    await writeFile(resolve(output, "deployment.json"), JSON.stringify(report, null, 2) + "\n")
  }
  return report
}
