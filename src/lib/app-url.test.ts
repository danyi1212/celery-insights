import { afterEach, describe, expect, it } from "vitest"
import { appUrl, appHref, getUrlPrefix } from "./app-url"

afterEach(() => document.querySelector('meta[name="url-prefix"]')?.remove())

describe("app URLs", () => {
  it("keeps hash links on the current document", () => {
    expect(appHref("#section")).toBe(`${window.location.pathname}${window.location.search}#section`)
    expect(appHref("https://example.com/docs")).toBe("https://example.com/docs")
    expect(appHref("//example.com/docs")).toBe("//example.com/docs")
  })

  it("defaults to the origin root in development and demo mode", () => {
    expect(getUrlPrefix()).toBe("")
    expect(appUrl("/api/config")).toBe("/api/config")
  })

  it("uses the runtime mount path for endpoints, assets and anchors", () => {
    const meta = document.createElement("meta")
    meta.name = "url-prefix"
    meta.content = "/tools/celery"
    document.head.appendChild(meta)
    expect(appUrl("/api/config")).toBe("/tools/celery/api/config")
    expect(appHref("/documentation/setup#section")).toBe("/tools/celery/documentation/setup#section")
    expect(appUrl("/LogoGreen.svg")).toBe("/tools/celery/LogoGreen.svg")
    expect(appUrl("/documentation/setup#operator-notes")).toBe("/tools/celery/documentation/setup#operator-notes")
  })
})
