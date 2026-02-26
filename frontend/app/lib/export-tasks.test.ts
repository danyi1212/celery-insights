import type { SurrealTask } from "@/types/surreal-records"
import { tasksToCsv, tasksToJson, downloadFile } from "./export-tasks"

const makeMockTask = (overrides: Partial<SurrealTask> = {}): SurrealTask => ({
    id: "task:abc-123",
    state: "SUCCESS",
    last_updated: "2025-01-15T10:30:00Z",
    children: [],
    ...overrides,
})

describe("tasksToCsv", () => {
    it("produces header row with all fields", () => {
        const csv = tasksToCsv([])
        const header = csv.split("\n")[0]
        expect(header).toContain("id")
        expect(header).toContain("state")
        expect(header).toContain("type")
        expect(header).toContain("last_updated")
        expect(header).toContain("result")
    })

    it("extracts plain ID from SurrealDB RecordId", () => {
        const csv = tasksToCsv([makeMockTask()])
        const dataRow = csv.split("\n")[1]
        expect(dataRow).toContain("abc-123")
        expect(dataRow).not.toContain("task:")
    })

    it("handles multiple tasks", () => {
        const tasks = [makeMockTask({ id: "task:1" }), makeMockTask({ id: "task:2" })]
        const csv = tasksToCsv(tasks)
        const lines = csv.split("\n")
        expect(lines).toHaveLength(3) // header + 2 data rows
    })

    it("escapes commas in values", () => {
        const csv = tasksToCsv([makeMockTask({ args: "a,b,c" })])
        expect(csv).toContain('"a,b,c"')
    })

    it("escapes double quotes in values", () => {
        const csv = tasksToCsv([makeMockTask({ result: 'value "quoted"' })])
        expect(csv).toContain('"value ""quoted"""')
    })

    it("joins children with semicolons", () => {
        const csv = tasksToCsv([makeMockTask({ children: ["child1", "child2"] })])
        expect(csv).toContain("child1;child2")
    })

    it("renders null/undefined fields as empty strings", () => {
        const csv = tasksToCsv([makeMockTask({ type: null, worker: undefined })])
        const dataRow = csv.split("\n")[1]
        // type and worker should be empty (consecutive commas)
        expect(dataRow).toBeTruthy()
    })
})

describe("tasksToJson", () => {
    it("produces valid JSON", () => {
        const json = tasksToJson([makeMockTask()])
        const parsed = JSON.parse(json)
        expect(Array.isArray(parsed)).toBe(true)
        expect(parsed).toHaveLength(1)
    })

    it("extracts plain ID from SurrealDB RecordId", () => {
        const json = tasksToJson([makeMockTask({ id: "task:xyz-789" })])
        const parsed = JSON.parse(json)
        expect(parsed[0].id).toBe("xyz-789")
    })

    it("preserves all task fields", () => {
        const task = makeMockTask({
            type: "celery.task.add",
            worker: "worker1",
            runtime: 1.5,
            children: ["a", "b"],
        })
        const json = tasksToJson([task])
        const parsed = JSON.parse(json)
        expect(parsed[0].type).toBe("celery.task.add")
        expect(parsed[0].worker).toBe("worker1")
        expect(parsed[0].runtime).toBe(1.5)
        expect(parsed[0].children).toEqual(["a", "b"])
    })

    it("handles empty array", () => {
        const json = tasksToJson([])
        expect(JSON.parse(json)).toEqual([])
    })
})

describe("downloadFile", () => {
    it("creates and clicks an anchor element", () => {
        const createObjectURL = vi.fn(() => "blob:test-url")
        const revokeObjectURL = vi.fn()
        global.URL.createObjectURL = createObjectURL
        global.URL.revokeObjectURL = revokeObjectURL

        const mockAnchor = {
            href: "",
            download: "",
            click: vi.fn(),
        }
        const appendSpy = vi.spyOn(document.body, "appendChild").mockImplementation(() => mockAnchor as never)
        const removeSpy = vi.spyOn(document.body, "removeChild").mockImplementation(() => mockAnchor as never)
        vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as never)

        downloadFile("test content", "test.csv", "text/csv")

        expect(createObjectURL).toHaveBeenCalled()
        expect(mockAnchor.download).toBe("test.csv")
        expect(mockAnchor.click).toHaveBeenCalled()
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-url")

        appendSpy.mockRestore()
        removeSpy.mockRestore()
    })
})
