import { extractId } from "./surreal-records"

describe("extractId", () => {
    it("extracts plain IDs from table-prefixed record IDs", () => {
        expect(extractId("task:abc-123")).toBe("abc-123")
        expect(extractId("worker:celery@worker-1")).toBe("celery@worker-1")
    })

    it("strips angle-bracket-wrapped IDs from Surreal serialization", () => {
        expect(extractId("task:<abc-123>")).toBe("abc-123")
        expect(extractId("task:⟨abc-123⟩")).toBe("abc-123")
    })

    it("strips quoted IDs from Surreal serialization", () => {
        expect(extractId("task:'abc-123'")).toBe("abc-123")
        expect(extractId('task:"abc-123"')).toBe("abc-123")
    })
})
