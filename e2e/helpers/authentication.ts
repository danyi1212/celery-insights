import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import http from "node:http"
import https from "node:https"
import { resolve } from "node:path"
import { request } from "../../tooling/playwright"
import { appOrigin, appPath, appURL } from "./app-url"

export const fixtureDirectory = resolve("test_project/.e2e-auth")
export const fixtureCredentials = { username: "admin", password: "synthetic-ci-configured-password" }
const certificatePath = resolve(fixtureDirectory, "certificate.pem")

export function prepareAuthenticationFixture() {
  mkdirSync(fixtureDirectory, { recursive: true, mode: 0o755 })
  execFileSync(
    "openssl",
    [
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
      resolve(fixtureDirectory, "key.pem"),
      "-out",
      certificatePath,
    ],
    { stdio: "ignore" },
  )
  writeFileSync(
    resolve(fixtureDirectory, "authentication.toml"),
    `schema_version = 1
[installation]
public_url = "${appOrigin}${appPath("/")}"
[authorization.opa]
decision_url = "http://opa:8181/v1/data/celery_insights/allow"
timeout_ms = 1000
[authentication]
mode = "basic"
[[authentication.accounts]]
username = "${fixtureCredentials.username}"
password = "${fixtureCredentials.password}"
roles = ["administrator"]
[[authentication.accounts]]
username = "policy-admin"
password = "synthetic-policy-secret"
roles = ["administrator"]
[[authentication.accounts]]
username = "reader"
password = "synthetic-reader-secret"
roles = ["viewer"]
`,
    { mode: 0o644 },
  )
  const prefix = appPath("")
  const locations = prefix
    ? `
    location = / { default_type text/plain; return 200 "Shared application root"; }
    location = ${prefix} { proxy_pass http://celery-insights:8555; }
    location ${prefix}/ { include /fixture/proxy.conf; }
    location / { return 404; }
`
    : "location / { include /fixture/proxy.conf; }"
  writeFileSync(
    resolve(fixtureDirectory, "proxy.conf"),
    `proxy_pass http://celery-insights:8555;
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
`,
  )
  writeFileSync(
    resolve(fixtureDirectory, "nginx.conf"),
    `map $http_upgrade $connection_upgrade {
default upgrade;
'' close;
}
server {
listen 443 ssl;
ssl_certificate /fixture/certificate.pem;
ssl_certificate_key /fixture/key.pem;
${locations}
}`,
  )
}

export async function verifyAuthenticationFixture() {
  const anonymous = await request.newContext({ ignoreHTTPSErrors: true })
  const authenticated = await request.newContext({
    ignoreHTTPSErrors: true,
    httpCredentials: { ...fixtureCredentials, origin: appOrigin, send: "always" },
  })
  try {
    if ((await anonymous.get(appURL("/metrics"))).status() !== 401)
      throw new Error("Fixture must deny anonymous metrics")
    if (!(await authenticated.get(appURL("/metrics"))).ok())
      throw new Error("Configured Basic account must authenticate")
  } finally {
    await anonymous.dispose()
    await authenticated.dispose()
  }
}

export function fixtureTlsOptions() {
  return { ca: readFileSync(certificatePath) }
}

export function fixtureAuthenticationHeaders(): Record<string, string> {
  return {
    Origin: appOrigin,
    Authorization:
      "Basic " + Buffer.from(`${fixtureCredentials.username}:${fixtureCredentials.password}`).toString("base64"),
    "X-Celery-Insights-Request": "1",
  }
}

/** Trust only the generated local certificate; never disable global TLS checks. */
export async function fixtureFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const destination = new URL(url)
  const isApp = destination.origin === appOrigin
  const headers = Object.fromEntries(new Headers(options.headers).entries())
  if (isApp) Object.assign(headers, fixtureAuthenticationHeaders())
  return new Promise((resolveResponse, reject) => {
    const transport = destination.protocol === "https:" ? https : http
    const req = transport.request(
      destination,
      {
        method: options.method,
        headers,
        ...(isApp ? fixtureTlsOptions() : {}),
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on("data", (chunk: Buffer) => chunks.push(chunk))
        res.on("end", () => resolveResponse(new Response(Buffer.concat(chunks).toString(), { status: res.statusCode })))
        res.on("error", reject)
      },
    )
    req.on("error", reject)
    req.setTimeout(10000, () => req.destroy(new Error("Fixture request timed out")))
    req.end(options.body)
  })
}
