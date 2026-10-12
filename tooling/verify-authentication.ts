/** Native configured-account acceptance, independent replicas and credential rotation. */
import assert from "node:assert/strict"
import { initializeAuthentication, secureApplicationRequest } from "../runtime/security/http"

const snapshot = {
  public_origin: "https://insights.example",
  accounts: [{ username: "admin", password: "synthetic-configured-secret", roles: ["administrator" as const] }],
}
const headers = { authorization: "Basic " + Buffer.from("admin:synthetic-configured-secret").toString("base64") }
const request = new Request(snapshot.public_origin + "/metrics", { headers })
for (let replica = 0; replica < 2; replica++) {
  const auth = initializeAuthentication(snapshot)
  assert.equal(auth.principal(request).account_id, "admin")
  assert.equal((await secureApplicationRequest(request, "", auth, false, async () => new Response("ok")))?.status, 200)
}
const rotated = initializeAuthentication({
  ...snapshot,
  accounts: [{ ...snapshot.accounts[0], password: "changed-secret" }],
})
assert.throws(() => rotated.principal(request))
assert.equal(
  (
    await secureApplicationRequest(
      new Request(request.url),
      "",
      initializeAuthentication(snapshot),
      false,
      async () => new Response("private"),
    )
  )?.status,
  401,
)

process.stdout.write("Basic authentication acceptance passed: configured accounts, replicas and credential rotation\n")
