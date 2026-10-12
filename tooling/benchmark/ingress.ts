import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

export const benchmarkAccount = { username: "benchmark", password: "synthetic-benchmark-password" }
export function benchmarkHeaders() {
  return {
    Authorization: `Basic ${Buffer.from(`${benchmarkAccount.username}:${benchmarkAccount.password}`).toString("base64")}`,
    Origin: process.env.BENCH_AUTH_ORIGIN ?? "https://benchmark.invalid",
    "X-Celery-Insights-Request": "1",
  }
}
export const benchmarkFetch: typeof fetch = (input, init = {}) =>
  fetch(input, {
    ...init,
    headers: { ...benchmarkHeaders(), ...Object.fromEntries(new Headers(init.headers)) },
  })

/** A local TLS terminator: authentication remains entirely in the production application. */
export async function benchmarkIngress(output: string) {
  const directory = resolve(output, "authentication")
  await mkdir(directory)
  await promisify(execFile)("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "1",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost,IP:127.0.0.1",
    "-keyout",
    resolve(directory, "key.pem"),
    "-out",
    resolve(directory, "certificate.pem"),
  ])
  const trace: Record<string, unknown>[] = []
  const tracing = process.env.BENCH_INGRESS_TRACE === "true"
  let backend: URL | undefined
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    tls: {
      key: await readFile(resolve(directory, "key.pem")),
      cert: await readFile(resolve(directory, "certificate.pem")),
    },
    async fetch(request: Request, instance: any) {
      if (!backend) return new Response(null, { status: 503 })
      const destination = new URL(new URL(request.url).pathname + new URL(request.url).search, backend)
      if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
        const protocol = request.headers
          .get("sec-websocket-protocol")
          ?.split(",")
          .map((value) => value.trim())
          .find((value) => value === "cbor" || value === "json")
        if (!protocol) return new Response(null, { status: 400 })
        const upgraded = instance.upgrade(request, {
          data: {
            destination: destination.toString().replace(/^http/, "ws"),
            headers: Object.fromEntries(request.headers),
            protocol,
            pending: [],
          },
          headers: { "sec-websocket-protocol": protocol },
        })
        return upgraded ? undefined : new Response(null, { status: 502 })
      }
      const observation =
        tracing && destination.pathname.endsWith(".css")
          ? ({
              path: destination.pathname,
              started: performance.now(),
              headers: Object.fromEntries(
                [...request.headers].filter(([key]) => !["cookie", "authorization"].includes(key)),
              ),
            } as Record<string, unknown>)
          : null
      if (observation) trace.push(observation)
      const upstream = await fetch(destination, {
        method: request.method,
        headers: request.headers,
        ...(request.method === "GET" || request.method === "HEAD" ? {} : { body: request.body }),
        redirect: "manual",
        signal: AbortSignal.timeout(120000),
      })
      // Bun fetch decodes response bodies. Frame the relay's actual bytes and
      // remove upstream connection/framing headers before serving over TLS.
      const headers = new Headers(upstream.headers)
      for (const header of ["connection", "keep-alive", "transfer-encoding", "content-length", "content-encoding"])
        headers.delete(header)
      const body = [204, 205, 304].includes(upstream.status) ? null : await upstream.arrayBuffer()
      if (observation)
        Object.assign(observation, {
          status: upstream.status,
          bytes: body?.byteLength ?? 0,
          elapsedMs: performance.now() - Number(observation.started),
          responseHeaders: Object.fromEntries(headers),
        })
      return new Response(body, { status: upstream.status, headers })
    },
    websocket: {
      maxPayloadLength: 16 * 1024 * 1024,
      backpressureLimit: 16 * 1024 * 1024,
      closeOnBackpressureLimit: true,
      open(client: any) {
        const headers = { ...client.data.headers, "Sec-WebSocket-Protocol": client.data.protocol }
        delete headers["sec-websocket-key"]
        delete headers["sec-websocket-extensions"]
        const upstream = new WebSocket(client.data.destination, { headers } as unknown as string[])
        client.data.upstream = upstream
        upstream.binaryType = "arraybuffer"
        upstream.onopen = () => {
          for (const message of client.data.pending) upstream.send(message)
          client.data.pending.length = 0
        }
        upstream.onmessage = (event) => client.send(event.data)
        upstream.onerror = () => client.close(1011, "Benchmark upstream unavailable")
        upstream.onclose = (event) => client.close(event.code === 1000 ? 1000 : 1011, "Benchmark upstream closed")
      },
      message(client: any, message: string | Buffer) {
        const payload = typeof message === "string" ? message : new Uint8Array(message)
        if (client.data.upstream?.readyState === WebSocket.OPEN) client.data.upstream.send(payload)
        else client.data.pending.push(payload)
      },
      close(client: any) {
        client.data.upstream?.close()
      },
    },
  })
  const url = `https://127.0.0.1:${server.port}`
  process.env.BENCH_AUTH_ORIGIN = url
  process.env.BENCH_AUTH_DIR = directory
  await writeFile(
    resolve(directory, "authentication.toml"),
    `schema_version = 1\n[installation]\npublic_url = "${url}"\n[authentication]\nmode = "basic"\n[authentication.session]\nsecret = "${Buffer.alloc(32, 17).toString("base64url")}"\n[[authentication.accounts]]\nusername = "${benchmarkAccount.username}"\npassword = "${benchmarkAccount.password}"\nroles = ["administrator"]\n`,
  )
  return {
    url,
    directory,
    setBackend(value: string) {
      backend = new URL(value)
    },
    async close() {
      await server.stop(true)
      if (tracing) await writeFile(resolve(output, "ingress-trace.json"), JSON.stringify(trace, null, 2))
    },
  }
}
