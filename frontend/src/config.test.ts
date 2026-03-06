import { describe, expect, it } from "vitest"
import { parseConfig } from "./config"

describe("parseConfig", () => {
    it("returns defaults when no env vars set", () => {
        const config = parseConfig({})
        expect(config.port).toBe(8555)
        expect(config.surrealdbUrl).toBe("ws://localhost:8557/rpc")
        expect(config.surrealdbIngesterPass).toBe("changeme")
        expect(config.surrealdbNamespace).toBe("celery_insights")
        expect(config.surrealdbDatabase).toBe("main")
        expect(config.surrealdbStorage).toBe("memory")
        expect(config.surrealdbPort).toBe(8557)
        expect(config.ingestionEnabled).toBe(true)
        expect(config.ingestionLeaderElection).toBe(true)
        expect(config.ingestionLockTtlSeconds).toBe(30)
        expect(config.ingestionLockHeartbeatSeconds).toBe(10)
        expect(config.cleanupIntervalSeconds).toBe(60)
        expect(config.taskMaxCount).toBeUndefined()
        expect(config.taskRetentionHours).toBeUndefined()
        expect(config.deadWorkerRetentionHours).toBe(24)
        expect(config.ingestionBatchIntervalMs).toBe(100)
        expect(config.brokerUrl).toBe("amqp://guest:guest@host.docker.internal/")
        expect(config.resultBackend).toBe("redis://host.docker.internal:6379/0")
        expect(config.configFile).toBe("/app/config.py")
        expect(config.timezone).toBe("UTC")
        expect(config.debug).toBe(false)
    })

    it("maps SCREAMING_SNAKE_CASE env vars to camelCase", () => {
        const config = parseConfig({
            PORT: "9000",
            SURREALDB_PORT: "9001",
            SURREALDB_STORAGE: "rocksdb:///data",
            BROKER_URL: "amqp://user:pass@broker/",
            DEBUG: "true",
            TIMEZONE: "America/New_York",
        })
        expect(config.port).toBe(9000)
        expect(config.surrealdbPort).toBe(9001)
        expect(config.surrealdbStorage).toBe("rocksdb:///data")
        expect(config.brokerUrl).toBe("amqp://user:pass@broker/")
        expect(config.debug).toBe(true)
        expect(config.timezone).toBe("America/New_York")
    })

    it("propagates external URL to surrealdbUrl when surrealdbUrl is default", () => {
        const config = parseConfig({
            SURREALDB_EXTERNAL_URL: "ws://external-surreal:8557/rpc",
        })
        expect(config.surrealdbExternalUrl).toBe("ws://external-surreal:8557/rpc")
        expect(config.surrealdbUrl).toBe("ws://external-surreal:8557/rpc")
    })

    it("preserves explicit surrealdbUrl when both are set", () => {
        const config = parseConfig({
            SURREALDB_URL: "ws://custom-internal:9000/rpc",
            SURREALDB_EXTERNAL_URL: "ws://external-surreal:8557/rpc",
        })
        expect(config.surrealdbUrl).toBe("ws://custom-internal:9000/rpc")
        expect(config.surrealdbExternalUrl).toBe("ws://external-surreal:8557/rpc")
    })

    it("leaves optional fields undefined when not set", () => {
        const config = parseConfig({})
        expect(config.surrealdbExternalUrl).toBeUndefined()
        expect(config.surrealdbFrontendPass).toBeUndefined()
        expect(config.taskMaxCount).toBeUndefined()
        expect(config.taskRetentionHours).toBeUndefined()
    })

    it("coerces boolean strings", () => {
        const configTrue = parseConfig({ INGESTION_ENABLED: "true" })
        expect(configTrue.ingestionEnabled).toBe(true)

        const configFalse = parseConfig({ INGESTION_ENABLED: "false" })
        expect(configFalse.ingestionEnabled).toBe(false)
    })

    it("coerces numeric strings", () => {
        const config = parseConfig({
            TASK_MAX_COUNT: "5000",
            TASK_RETENTION_HOURS: "48.5",
            INGESTION_BATCH_INTERVAL_MS: "200",
        })
        expect(config.taskMaxCount).toBe(5000)
        expect(config.taskRetentionHours).toBe(48.5)
        expect(config.ingestionBatchIntervalMs).toBe(200)
    })

    it("rejects heartbeat >= TTL", () => {
        expect(() =>
            parseConfig({
                INGESTION_LOCK_TTL_SECONDS: "10",
                INGESTION_LOCK_HEARTBEAT_SECONDS: "10",
            }),
        ).toThrow("INGESTION_LOCK_HEARTBEAT_SECONDS must be less than INGESTION_LOCK_TTL_SECONDS")
    })

    it("rejects heartbeat > TTL", () => {
        expect(() =>
            parseConfig({
                INGESTION_LOCK_TTL_SECONDS: "10",
                INGESTION_LOCK_HEARTBEAT_SECONDS: "15",
            }),
        ).toThrow("INGESTION_LOCK_HEARTBEAT_SECONDS must be less than INGESTION_LOCK_TTL_SECONDS")
    })

    it("accepts heartbeat < TTL", () => {
        const config = parseConfig({
            INGESTION_LOCK_TTL_SECONDS: "30",
            INGESTION_LOCK_HEARTBEAT_SECONDS: "10",
        })
        expect(config.ingestionLockTtlSeconds).toBe(30)
        expect(config.ingestionLockHeartbeatSeconds).toBe(10)
    })

    it("ignores unknown env vars", () => {
        const config = parseConfig({
            UNKNOWN_VAR: "value",
            ANOTHER: "test",
        })
        expect(config.port).toBe(8555)
    })

    it("accepts frontend password", () => {
        const config = parseConfig({
            SURREALDB_FRONTEND_PASS: "mysecret",
        })
        expect(config.surrealdbFrontendPass).toBe("mysecret")
    })
})
