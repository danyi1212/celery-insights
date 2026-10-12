import { renderHook } from "@test-utils"
import { useWorker } from "@hooks/use-live-workers"
import { useWorkerActiveTasks } from "./use-worker-inspect"
import type { SurrealWorker, TaskRequest } from "@/types/surreal-records"

vi.mock("@hooks/use-live-workers", () => ({ useWorker: vi.fn() }))

const now = new Date("2026-10-06T12:00:00Z")
const request: TaskRequest = {
  id: "task",
  name: "tasks.run",
  type: "tasks.run",
  args: [],
  kwargs: {},
  hostname: "worker",
}

const observe = (inspect: object, status = "online") => {
  const worker: SurrealWorker = {
    id: "worker:host",
    status,
    last_updated: now.toISOString(),
    inspect: JSON.stringify(inspect),
  }
  vi.mocked(useWorker).mockReturnValue({ worker, data: [worker], isLoading: false, error: null })
  return renderHook(() => useWorkerActiveTasks("host"))
}

describe("useWorkerActiveTasks", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })
  afterEach(() => vi.useRealTimers())

  it("keeps a successful empty inspection distinct from unavailable data", () => {
    expect(observe({ active: [], _observed_at: { active: now.toISOString() } }).result.current.tasks).toEqual([])
    expect(observe({ stats: {} }).result.current.tasks).toBeUndefined()
  })

  it("returns running tasks only while inspection evidence is fresh", () => {
    expect(observe({ active: [request], _observed_at: { active: now.toISOString() } }).result.current.tasks).toEqual([
      request,
    ])
    expect(
      observe({ active: [request], _observed_at: { active: new Date(now.getTime() - 180_000).toISOString() } }).result
        .current.tasks,
    ).toBeUndefined()
  })

  it("does not treat a stored active list as current after a worker goes offline", () => {
    expect(
      observe({ active: [request], _observed_at: { active: now.toISOString() } }, "offline").result.current.tasks,
    ).toBeUndefined()
  })
})
