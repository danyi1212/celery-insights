import { TaskState } from "@services/server"
import { createServerTask, createServerWorker } from "@/test-fixtures"
import { translateTask, translateWorker } from "./translate-server-models"

describe("translateTask", () => {
    it("converts Unix timestamps to Date objects", () => {
        const server = createServerTask({ sent_at: 1700000000, last_updated: 1700000005 })
        const result = translateTask(server)
        expect(result.sentAt).toEqual(new Date(1700000000 * 1000))
        expect(result.lastUpdated).toEqual(new Date(1700000005 * 1000))
    })

    it("converts null optional timestamps to undefined", () => {
        const server = createServerTask({
            received_at: null,
            started_at: null,
            succeeded_at: null,
            failed_at: null,
        })
        const result = translateTask(server)
        expect(result.receivedAt).toBeUndefined()
        expect(result.startedAt).toBeUndefined()
        expect(result.succeededAt).toBeUndefined()
        expect(result.failedAt).toBeUndefined()
    })

    it("maps snake_case fields to camelCase", () => {
        const server = createServerTask({
            sent_at: 1700000000,
            received_at: 1700000001,
            started_at: 1700000002,
            routing_key: "custom-queue",
            root_id: "root-123",
            parent_id: "parent-456",
        })
        const result = translateTask(server)
        expect(result.sentAt).toBeDefined()
        expect(result.receivedAt).toBeDefined()
        expect(result.startedAt).toBeDefined()
        expect(result.routingKey).toBe("custom-queue")
        expect(result.rootId).toBe("root-123")
        expect(result.parentId).toBe("parent-456")
    })

    it("preserves children array", () => {
        const server = createServerTask({ children: ["child-1", "child-2", "child-3"] })
        const result = translateTask(server)
        expect(result.children).toEqual(["child-1", "child-2", "child-3"])
    })

    it("converts empty string fields to undefined", () => {
        const server = createServerTask({ type: "", args: "", kwargs: "", worker: "" })
        const result = translateTask(server)
        expect(result.type).toBeUndefined()
        expect(result.args).toBeUndefined()
        expect(result.kwargs).toBeUndefined()
        expect(result.worker).toBeUndefined()
    })

    it("preserves state enum", () => {
        const server = createServerTask({ state: TaskState.FAILURE })
        const result = translateTask(server)
        expect(result.state).toBe(TaskState.FAILURE)
    })

    it("preserves non-null optional fields", () => {
        const server = createServerTask({
            eta: "2024-01-01T00:00:00",
            expires: "2024-01-02T00:00:00",
            retries: 3,
            exchange: "custom-exchange",
        })
        const result = translateTask(server)
        expect(result.eta).toBe("2024-01-01T00:00:00")
        expect(result.expires).toBe("2024-01-02T00:00:00")
        expect(result.retries).toBe(3)
        expect(result.exchange).toBe("custom-exchange")
    })

    it("converts all timestamp fields when present", () => {
        const server = createServerTask({
            sent_at: 1700000000,
            received_at: 1700000001,
            started_at: 1700000002,
            succeeded_at: 1700000005,
            retried_at: 1700000003,
            revoked_at: 1700000004,
            rejected_at: 1700000006,
        })
        const result = translateTask(server)
        expect(result.receivedAt).toEqual(new Date(1700000001 * 1000))
        expect(result.startedAt).toEqual(new Date(1700000002 * 1000))
        expect(result.succeededAt).toEqual(new Date(1700000005 * 1000))
        expect(result.retriedAt).toEqual(new Date(1700000003 * 1000))
        expect(result.revokedAt).toEqual(new Date(1700000004 * 1000))
        expect(result.rejectedAt).toEqual(new Date(1700000006 * 1000))
    })
})

describe("translateWorker", () => {
    it("converts timestamps to Date objects", () => {
        const server = createServerWorker({ last_updated: 1700000000, heartbeat_expires: 1700000120 })
        const result = translateWorker(server)
        expect(result.lastUpdated).toEqual(new Date(1700000000 * 1000))
        expect(result.heartbeatExpires).toEqual(new Date(1700000120 * 1000))
    })

    it("maps snake_case fields to camelCase", () => {
        const server = createServerWorker({
            software_identity: "py-celery",
            software_version: "5.4.0",
            software_sys: "Linux",
            active_tasks: 5,
            processed_tasks: 200,
        })
        const result = translateWorker(server)
        expect(result.softwareIdentity).toBe("py-celery")
        expect(result.softwareVersion).toBe("5.4.0")
        expect(result.softwareSys).toBe("Linux")
        expect(result.activeTasks).toBe(5)
        expect(result.processedTasks).toBe(200)
    })

    it("preserves cpuLoad as tuple", () => {
        const server = createServerWorker({ cpu_load: [1.5, 2.0, 3.5] })
        const result = translateWorker(server)
        expect(result.cpuLoad).toEqual([1.5, 2.0, 3.5])
    })

    it("converts null heartbeat_expires to undefined", () => {
        const server = createServerWorker({ heartbeat_expires: null })
        const result = translateWorker(server)
        expect(result.heartbeatExpires).toBeUndefined()
    })
})
