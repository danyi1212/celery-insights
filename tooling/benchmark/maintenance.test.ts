// @vitest-environment node
import { expect, test } from "vitest"
import { validateBackup, validateRestoredPayloads, maintenanceDeadline } from "./maintenance"

const backup = () => ({
  version: 1,
  tasks: [
    { id: "task:history-0", state: "FAILURE", type: "history.work.0", workflow_id: "history-0" },
    { id: "task:bench-0", state: "SUCCESS", type: "benchmark.work", workflow_id: "bench-0" },
  ],
  events: [
    ...Array.from({ length: 4 }, (_, phase) => ({ id: `event:history-0-${phase}`, task_id: "history-0", data: "{}" })),
    ...Array.from({ length: 4 }, (_, sequence) => ({
      id: `event:bench-${sequence}`,
      task_id: "bench-0",
      data: JSON.stringify({ bench_sequence: sequence }),
    })),
  ],
  workers: [],
})

test("a disconnected maintenance operation has a bounded deadline", async () => {
  await expect(maintenanceDeadline(new Promise(() => {}), 10, "Disconnected fixture")).rejects.toThrow(
    "deadline exceeded",
  )
  await expect(maintenanceDeadline(Promise.resolve(123), 1000, "Available fixture")).resolves.toBe(123)
})

test("restored payloads cannot change despite correct record counts and IDs", () => {
  const original = backup(),
    restored = backup()
  validateRestoredPayloads(original, restored)
  Object.assign(restored.tasks[1], { result: "wrong result" })
  expect(() => validateRestoredPayloads(original, restored)).toThrow("Restored task payload differs")
  const alteredEvent = backup()
  alteredEvent.events[0].data = '{"lost":"payload"}'
  expect(() => validateRestoredPayloads(original, alteredEvent)).toThrow("Restored raw event payload differs")
})

test("backup validation rejects task substitution and duplicate raw events despite matching counts", () => {
  expect(validateBackup(backup(), 1, 1)).toMatchObject({ tasks: 2, events: 8 })
  const foreign = backup()
  foreign.tasks[0].id = "task:history-9"
  expect(() => validateBackup(foreign, 1, 1)).toThrow("outside manifest")
  const duplicate = backup()
  duplicate.events[7].data = duplicate.events[6].data
  expect(() => validateBackup(duplicate, 1, 1)).toThrow("coverage differs")
  const missingHistory = backup()
  missingHistory.events[0].id = "event:history-wrong"
  expect(() => validateBackup(missingHistory, 1, 1)).toThrow("Historical event identity differs")
})
