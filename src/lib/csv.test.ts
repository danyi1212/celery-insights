import { expect, it } from "vitest"
import { csvText } from "./csv"

it.each(["=1+1", "+1", "-1", "@SUM(1)", " \t=1", "\r=1", "\n=1", "\u0000=1", "\ttext"])(
  "forces spreadsheet text for %j",
  (value) => expect(csvText(value)).toBe(`'${value}`),
)
it("preserves numbers and ordinary text", () => {
  expect(csvText(-1)).toBe("-1")
  expect(csvText("celery.tasks.run")).toBe("celery.tasks.run")
  expect(csvText(null)).toBe("")
})
