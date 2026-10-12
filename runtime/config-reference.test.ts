import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { configReference, exampleConfig } from "./config-cli"
import { resolveConfig } from "./config-loader"

it("keeps the published setting catalog generated from the registry", () => {
  const docs = readFileSync("src/content/docs/configuration.mdx", "utf8")
  const generated = docs
    .split("{/* BEGIN GENERATED CONFIG REFERENCE */}\n")[1]
    .split("{/* END GENERATED CONFIG REFERENCE */}")[0]
  const cells = (markdown: string) =>
    markdown
      .split("\n")
      .filter((line) => line.startsWith("|") && !/^\|[\s|:-]+$/.test(line))
      .map((line) => line.split("|").map((cell) => cell.trim()))
  expect(cells(generated)).toEqual(cells(configReference()))
})

it("validates the shipped example with supplied secret files", () => {
  const result = resolveConfig({
    env: {},
    configFile: "/example.toml",
    readFile: (file) =>
      file === "/example.toml"
        ? exampleConfig()
        : file.endsWith("session-secret")
          ? Buffer.alloc(32, 5).toString("base64url")
          : "test-credential\n",
  })
  expect(result.config.surrealdbStorage).toBe("rocksdb:///data/surreal")
  expect(result.config.brokerUrl).toBe("test-credential")
})
