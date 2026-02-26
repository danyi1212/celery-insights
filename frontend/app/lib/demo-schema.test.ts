import { DEMO_SCHEMA } from "./demo-schema"

describe("DEMO_SCHEMA", () => {
    it("defines task table with FULL permissions", () => {
        expect(DEMO_SCHEMA).toContain("DEFINE TABLE IF NOT EXISTS task SCHEMAFULL PERMISSIONS FULL")
    })

    it("defines event table with FULL permissions", () => {
        expect(DEMO_SCHEMA).toContain("DEFINE TABLE IF NOT EXISTS event SCHEMALESS PERMISSIONS FULL")
    })

    it("defines worker table with FULL permissions", () => {
        expect(DEMO_SCHEMA).toContain("DEFINE TABLE IF NOT EXISTS worker SCHEMALESS PERMISSIONS FULL")
    })

    it("does not define ingestion_lock table", () => {
        expect(DEMO_SCHEMA).not.toContain("ingestion_lock")
    })

    it("does not define auth-related tables", () => {
        expect(DEMO_SCHEMA).not.toContain("viewer")
        expect(DEMO_SCHEMA).not.toContain("DEFINE ACCESS")
    })

    it("defines all task fields", () => {
        const expectedFields = [
            "type",
            "state",
            "sent_at",
            "received_at",
            "started_at",
            "succeeded_at",
            "failed_at",
            "retried_at",
            "revoked_at",
            "rejected_at",
            "runtime",
            "last_updated",
            "args",
            "kwargs",
            "eta",
            "expires",
            "retries",
            "exchange",
            "routing_key",
            "root_id",
            "parent_id",
            "children",
            "worker",
            "result",
            "result_truncated",
            "exception",
            "traceback",
        ]
        for (const field of expectedFields) {
            expect(DEMO_SCHEMA).toContain(`DEFINE FIELD OVERWRITE ${field} ON task`)
        }
    })

    it("defines task indexes", () => {
        expect(DEMO_SCHEMA).toContain("DEFINE INDEX OVERWRITE idx_task_state ON task FIELDS state")
        expect(DEMO_SCHEMA).toContain("DEFINE INDEX OVERWRITE idx_task_type ON task FIELDS type")
        expect(DEMO_SCHEMA).toContain("DEFINE INDEX OVERWRITE idx_task_worker ON task FIELDS worker")
        expect(DEMO_SCHEMA).toContain("DEFINE INDEX OVERWRITE idx_task_root_id ON task FIELDS root_id")
        expect(DEMO_SCHEMA).toContain("DEFINE INDEX OVERWRITE idx_task_last_updated ON task FIELDS last_updated")
    })

    it("defines event indexes", () => {
        expect(DEMO_SCHEMA).toContain("DEFINE INDEX OVERWRITE idx_event_task_id ON event FIELDS task_id")
        expect(DEMO_SCHEMA).toContain("DEFINE INDEX OVERWRITE idx_event_type ON event FIELDS event_type")
        expect(DEMO_SCHEMA).toContain("DEFINE INDEX OVERWRITE idx_event_timestamp ON event FIELDS timestamp")
    })

    it("defines worker fields and indexes", () => {
        expect(DEMO_SCHEMA).toContain("DEFINE FIELD OVERWRITE status ON worker TYPE string")
        expect(DEMO_SCHEMA).toContain("DEFINE FIELD OVERWRITE missed_polls ON worker TYPE int")
        expect(DEMO_SCHEMA).toContain("DEFINE INDEX OVERWRITE idx_worker_last_updated ON worker FIELDS last_updated")
        expect(DEMO_SCHEMA).toContain("DEFINE INDEX OVERWRITE idx_worker_status ON worker FIELDS status")
    })
})
