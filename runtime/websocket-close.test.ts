// @vitest-environment node
import { expect, test, vi } from "vitest"
import { execFile } from "node:child_process"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { promisify } from "node:util"
import { forwardBackendClosure } from "./websocket-close"

test.each([1000, 1001, 1011, 1012, 1013, 4001])("proxy preserves backend close %s and its reason", (code) => {
  const backend: Pick<WebSocket, "onclose" | "onerror"> = { onclose: null, onerror: null }
  const close = vi.fn()
  forwardBackendClosure(backend, { close })
  backend.onclose!.call(null!, { code, reason: "backend explanation" } as CloseEvent)
  expect(close).toHaveBeenCalledWith(code, "backend explanation")
})

test.each([0, 1004, 1005, 1006, 1015, 2999, 5000])("proxy maps unsendable close %s to failure", (code) => {
  const backend: Pick<WebSocket, "onclose" | "onerror"> = { onclose: null, onerror: null }
  const close = vi.fn()
  forwardBackendClosure(backend, { close })
  backend.onclose!.call(null!, { code, reason: "" } as CloseEvent)
  expect(close).toHaveBeenCalledWith(1011, "Database connection closed unexpectedly")
})

test("backend transport errors are reported as failures", () => {
  const backend: Pick<WebSocket, "onclose" | "onerror"> = { onclose: null, onerror: null }
  const close = vi.fn()
  forwardBackendClosure(backend, { close })
  backend.onerror!.call(null!, {} as Event)
  expect(close).toHaveBeenCalledWith(1011, "Database connection failed")
})

test("real Bun proxy sends backend closure semantics to its downstream client", async () => {
  const moduleUrl = pathToFileURL(resolve("runtime/websocket-close.ts")).href
  const script = `
    import { forwardBackendClosure } from ${JSON.stringify(moduleUrl)};
    import assert from "node:assert/strict";
    for (const code of [1000, 1011, 1012, 1013, 4001, 1006]) {
      const fetch = (req, server) => server.upgrade(req) ? undefined : new Response("bad upgrade", {status:400});
      const backend = Bun.serve({hostname:"127.0.0.1", port:0, fetch, websocket:{
        message(){}, open(ws){ code === 1006 ? ws.terminate() : ws.close(code, "backend explanation"); }
      }});
      const proxy = Bun.serve({hostname:"127.0.0.1", port:0, fetch, websocket:{
        message(){}, open(ws){ forwardBackendClosure(new WebSocket("ws://127.0.0.1:" + backend.port), ws); }
      }});
      try {
        const observed = await new Promise((resolve, reject) => {
          const client = new WebSocket("ws://127.0.0.1:" + proxy.port);
          const timer = setTimeout(() => reject(new Error("close timed out")), 3000);
          client.onclose = event => { clearTimeout(timer); resolve({code:event.code, reason:event.reason}); };
        });
        assert.equal(observed.code, code === 1006 ? 1011 : code);
        assert.equal(observed.reason, code === 1006 ? "Database connection closed unexpectedly" : "backend explanation");
      } finally { proxy.stop(true); backend.stop(true); }
    }
    process.exit(0);
  `
  await expect(promisify(execFile)("bun", ["--eval", script], { timeout: 12_000 })).resolves.toMatchObject({
    stdout: "",
    stderr: "",
  })
}, 15_000)
