// @vitest-environment node
import { expect, test } from "vitest"
import { parseFailoverProducerOutput } from "./failover"

test("failover preserves independently detected event loss from a failing producer", () => {
  const result = { status: "failed", errors: ["Raw event coverage differs: expected 512, received 132"] }
  expect(parseFailoverProducerOutput("producer starting\n" + JSON.stringify(result) + "\n", true)).toEqual(result)
})

test("failed producer execution cannot supply a passing failover oracle", () => {
  expect(() => parseFailoverProducerOutput('{"status":"passed"}', true)).toThrow("exited unsuccessfully")
  for (const output of ["null", "{}", '{"status":"unknown"}', "transport disconnected"])
    expect(() => parseFailoverProducerOutput(output, true)).toThrow(Error)
})
