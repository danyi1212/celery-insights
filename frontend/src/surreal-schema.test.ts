import { describe, expect, it, vi, beforeEach } from "vitest"
import type { Config } from "./config"
import { assertIdent } from "./surreal-schema"

function createMockDb() {
    const queryResult: { collect: () => Promise<unknown[]> } = {
        collect: vi.fn().mockResolvedValue([]),
    }
    return {
        connect: vi.fn().mockResolvedValue(undefined),
        use: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockReturnValue(queryResult),
        close: vi.fn().mockResolvedValue(undefined),
        _queryResult: queryResult,
    }
}

let mockDb: ReturnType<typeof createMockDb>

vi.mock("surrealdb", () => ({
    default: vi.fn(function () {
        return mockDb
    }),
}))

// Import after vi.mock
const { runSchemaMigration } = await import("./surreal-schema")

function createConfig(overrides: Partial<Config> = {}): Config {
    return {
        port: 8555,
        surrealdbUrl: "ws://localhost:8557/rpc",
        surrealdbIngesterPass: "test-pass",
        surrealdbNamespace: "celery_insights",
        surrealdbDatabase: "main",
        surrealdbStorage: "memory",
        surrealdbPort: 8557,
        ingestionEnabled: true,
        ingestionLeaderElection: true,
        ingestionLockTtlSeconds: 30,
        ingestionLockHeartbeatSeconds: 10,
        cleanupIntervalSeconds: 60,
        deadWorkerRetentionHours: 24,
        ingestionBatchIntervalMs: 100,
        brokerUrl: "amqp://guest:guest@localhost/",
        resultBackend: "redis://localhost:6379/0",
        configFile: "/app/config.py",
        timezone: "UTC",
        debug: false,
        ...overrides,
    }
}

describe("assertIdent", () => {
    it("accepts valid identifiers", () => {
        expect(assertIdent("celery_insights", "ns")).toBe("celery_insights")
        expect(assertIdent("main", "db")).toBe("main")
        expect(assertIdent("_private", "db")).toBe("_private")
        expect(assertIdent("DB123", "db")).toBe("DB123")
    })

    it("rejects identifiers with spaces", () => {
        expect(() => assertIdent("bad name", "namespace")).toThrow("Invalid SurrealDB identifier")
    })

    it("rejects identifiers with hyphens", () => {
        expect(() => assertIdent("my-db", "database")).toThrow("Invalid SurrealDB identifier")
    })

    it("rejects identifiers starting with a number", () => {
        expect(() => assertIdent("123abc", "namespace")).toThrow("Invalid SurrealDB identifier")
    })

    it("rejects empty strings", () => {
        expect(() => assertIdent("", "namespace")).toThrow("Invalid SurrealDB identifier")
    })
})

describe("runSchemaMigration", () => {
    beforeEach(() => {
        mockDb = createMockDb()
    })

    it("connects as root", async () => {
        await runSchemaMigration(createConfig())

        expect(mockDb.connect).toHaveBeenCalledWith("ws://localhost:8557/rpc", {
            authentication: { username: "root", password: "root" },
        })
    })

    it("creates namespace and database with IF NOT EXISTS", async () => {
        await runSchemaMigration(createConfig())

        const queries = mockDb.query.mock.calls.map((c) => c[0] as string)
        expect(queries[0]).toBe("DEFINE NAMESPACE IF NOT EXISTS celery_insights")
        expect(queries[1]).toBe("DEFINE DATABASE IF NOT EXISTS main")
    })

    it("switches to target namespace and database", async () => {
        await runSchemaMigration(createConfig())

        expect(mockDb.use).toHaveBeenCalledWith({ namespace: "celery_insights" })
        expect(mockDb.use).toHaveBeenCalledWith({ namespace: "celery_insights", database: "main" })
    })

    it("creates ingester user with OVERWRITE and correct password", async () => {
        await runSchemaMigration(createConfig({ surrealdbIngesterPass: "my-secret" }))

        expect(mockDb.query).toHaveBeenCalledWith(
            "DEFINE USER OVERWRITE ingester ON DATABASE PASSWORD $pass ROLES OWNER",
            { pass: "my-secret" },
        )
    })

    it("applies core schema with all tables", async () => {
        await runSchemaMigration(createConfig())

        const queries = mockDb.query.mock.calls.map((c) => c[0] as string)
        const coreSchema = queries.find((q) => q.includes("DEFINE TABLE IF NOT EXISTS task"))!

        expect(coreSchema).toBeDefined()
        expect(coreSchema).toContain("DEFINE TABLE IF NOT EXISTS task SCHEMAFULL")
        expect(coreSchema).toContain("DEFINE TABLE IF NOT EXISTS event SCHEMALESS")
        expect(coreSchema).toContain("DEFINE TABLE IF NOT EXISTS worker SCHEMALESS")
        expect(coreSchema).toContain("DEFINE TABLE IF NOT EXISTS ingestion_lock SCHEMAFULL")
    })

    it("applies core schema with fields and indexes using OVERWRITE", async () => {
        await runSchemaMigration(createConfig())

        const queries = mockDb.query.mock.calls.map((c) => c[0] as string)
        const coreSchema = queries.find((q) => q.includes("DEFINE TABLE IF NOT EXISTS task"))!

        // Task fields
        expect(coreSchema).toContain("DEFINE FIELD OVERWRITE state ON task TYPE string")
        expect(coreSchema).toContain("DEFINE FIELD OVERWRITE type ON task TYPE option<string>")
        expect(coreSchema).toContain("DEFINE FIELD OVERWRITE children ON task TYPE array<string> DEFAULT []")
        expect(coreSchema).toContain("DEFINE FIELD OVERWRITE result_truncated ON task TYPE bool DEFAULT false")

        // Worker fields
        expect(coreSchema).toContain('DEFINE FIELD OVERWRITE status ON worker TYPE string DEFAULT "online"')
        expect(coreSchema).toContain("DEFINE FIELD OVERWRITE missed_polls ON worker TYPE int DEFAULT 0")

        // Ingestion lock fields
        expect(coreSchema).toContain("DEFINE FIELD OVERWRITE holder ON ingestion_lock TYPE string")
        expect(coreSchema).toContain("DEFINE FIELD OVERWRITE ttl_seconds ON ingestion_lock TYPE int DEFAULT 30")

        // Task indexes
        expect(coreSchema).toContain("DEFINE INDEX OVERWRITE idx_task_state ON task FIELDS state")
        expect(coreSchema).toContain("DEFINE INDEX OVERWRITE idx_task_last_updated ON task FIELDS last_updated")

        // Event indexes
        expect(coreSchema).toContain("DEFINE INDEX OVERWRITE idx_event_task_id ON event FIELDS task_id")

        // Worker indexes
        expect(coreSchema).toContain("DEFINE INDEX OVERWRITE idx_worker_status ON worker FIELDS status")
    })

    it("sets correct table permissions", async () => {
        await runSchemaMigration(createConfig())

        const queries = mockDb.query.mock.calls.map((c) => c[0] as string)
        const coreSchema = queries.find((q) => q.includes("DEFINE TABLE IF NOT EXISTS task"))!

        expect(coreSchema).toContain("FOR select FULL")
        expect(coreSchema).toContain("FOR create, update, delete NONE")
    })

    describe("frontend auth enabled", () => {
        it("creates viewer table and access when frontendPass is set", async () => {
            await runSchemaMigration(createConfig({ surrealdbFrontendPass: "secret123" }))

            const queries = mockDb.query.mock.calls.map((c) => c[0] as string)
            const authSchema = queries.find((q) => q.includes("DEFINE ACCESS OVERWRITE frontend"))!

            expect(authSchema).toBeDefined()
            expect(authSchema).toContain("DEFINE TABLE IF NOT EXISTS viewer SCHEMAFULL")
            expect(authSchema).toContain("PERMISSIONS NONE")
            expect(authSchema).toContain("DEFINE FIELD OVERWRITE name ON viewer TYPE string")
            expect(authSchema).toContain("DEFINE FIELD OVERWRITE pass ON viewer TYPE string")
            expect(authSchema).toContain("DEFINE ACCESS OVERWRITE frontend ON DATABASE TYPE RECORD")
            expect(authSchema).toContain("SIGNUP NONE")
            expect(authSchema).toContain("crypto::argon2::compare(pass, $pass)")
        })

        it("upserts viewer record with hashed password", async () => {
            await runSchemaMigration(createConfig({ surrealdbFrontendPass: "secret123" }))

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining("UPSERT viewer:frontend"),
                { pass: "secret123" },
            )

            const upsertCall = mockDb.query.mock.calls.find(
                (c) => typeof c[0] === "string" && c[0].includes("UPSERT viewer:frontend"),
            )!
            expect(upsertCall[0]).toContain("crypto::argon2::generate($pass)")
        })
    })

    describe("frontend auth disabled", () => {
        it("removes frontend access and viewer table when frontendPass is not set", async () => {
            await runSchemaMigration(createConfig())

            const queries = mockDb.query.mock.calls.map((c) => c[0] as string)
            expect(queries).toContain("REMOVE ACCESS IF EXISTS frontend ON DATABASE")
            expect(queries).toContain("REMOVE TABLE IF EXISTS viewer")
        })

        it("does not create viewer table or access", async () => {
            await runSchemaMigration(createConfig())

            const queries = mockDb.query.mock.calls.map((c) => c[0] as string)
            expect(queries.find((q) => q.includes("DEFINE ACCESS OVERWRITE frontend"))).toBeUndefined()
            expect(queries.find((q) => q.includes("UPSERT viewer:frontend"))).toBeUndefined()
        })
    })

    it("always closes the connection", async () => {
        await runSchemaMigration(createConfig())
        expect(mockDb.close).toHaveBeenCalledOnce()
    })

    it("closes the connection even when a query fails", async () => {
        mockDb._queryResult.collect = vi.fn().mockRejectedValue(new Error("query failed"))

        await expect(runSchemaMigration(createConfig())).rejects.toThrow("query failed")
        expect(mockDb.close).toHaveBeenCalledOnce()
    })

    it("rejects invalid namespace identifiers", async () => {
        await expect(runSchemaMigration(createConfig({ surrealdbNamespace: "bad namespace" }))).rejects.toThrow(
            "Invalid SurrealDB identifier for namespace",
        )
    })

    it("rejects invalid database identifiers", async () => {
        await expect(runSchemaMigration(createConfig({ surrealdbDatabase: "my-db" }))).rejects.toThrow(
            "Invalid SurrealDB identifier for database",
        )
    })

    it("uses custom namespace and database from config", async () => {
        await runSchemaMigration(createConfig({ surrealdbNamespace: "custom_ns", surrealdbDatabase: "custom_db" }))

        const queries = mockDb.query.mock.calls.map((c) => c[0] as string)
        expect(queries[0]).toBe("DEFINE NAMESPACE IF NOT EXISTS custom_ns")
        expect(queries[1]).toBe("DEFINE DATABASE IF NOT EXISTS custom_db")
        expect(mockDb.use).toHaveBeenCalledWith({ namespace: "custom_ns" })
        expect(mockDb.use).toHaveBeenCalledWith({ namespace: "custom_ns", database: "custom_db" })
    })
})
