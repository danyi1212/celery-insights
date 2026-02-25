import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { LeaderElection, generateInstanceId } from "./leader-election"
import type { Config } from "./config"

function createMockDb() {
    const queryResult: { collect: () => Promise<unknown[]> } = {
        collect: vi.fn().mockResolvedValue([[]]),
    }
    return {
        query: vi.fn().mockReturnValue(queryResult),
        _queryResult: queryResult,
    }
}

function createConfig(overrides: Partial<Config> = {}): Config {
    return {
        port: 8555,
        surrealdbUrl: "ws://localhost:8557/rpc",
        surrealdbIngesterPass: "changeme",
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

describe("generateInstanceId", () => {
    it("returns a string with hostname:pid:suffix format", () => {
        const id = generateInstanceId()
        const parts = id.split(":")
        expect(parts.length).toBe(3)
        expect(parts[1]).toBe(String(process.pid))
        expect(parts[2].length).toBeGreaterThan(0)
    })

    it("generates unique IDs", () => {
        const id1 = generateInstanceId()
        const id2 = generateInstanceId()
        expect(id1).not.toBe(id2)
    })
})

describe("LeaderElection", () => {
    let mockDb: ReturnType<typeof createMockDb>
    let onBecomeLeader: ReturnType<typeof vi.fn>
    let onLoseLeadership: ReturnType<typeof vi.fn>

    beforeEach(() => {
        vi.useFakeTimers()
        mockDb = createMockDb()
        onBecomeLeader = vi.fn()
        onLoseLeadership = vi.fn()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    function createElection(configOverrides: Partial<Config> = {}): LeaderElection {
        return new LeaderElection({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            db: mockDb as any,
            config: createConfig(configOverrides),
            instanceId: "testhost:1234:abc123",
            onBecomeLeader,
            onLoseLeadership,
        })
    }

    describe("ingestion disabled", () => {
        it("returns disabled status without querying SurrealDB", async () => {
            const election = createElection({ ingestionEnabled: false })
            const status = await election.start()

            expect(status).toBe("disabled")
            expect(election.isLeader).toBe(false)
            expect(election.status).toBe("disabled")
            expect(mockDb.query).not.toHaveBeenCalled()
            expect(onBecomeLeader).not.toHaveBeenCalled()
            await election.stop()
        })
    })

    describe("leader election disabled", () => {
        it("assumes leader role immediately", async () => {
            const election = createElection({ ingestionLeaderElection: false })
            const status = await election.start()

            expect(status).toBe("leader")
            expect(election.isLeader).toBe(true)
            expect(onBecomeLeader).toHaveBeenCalledTimes(1)
            expect(mockDb.query).not.toHaveBeenCalled()
            await election.stop()
        })
    })

    describe("lock acquisition", () => {
        it("becomes leader when lock is acquired", async () => {
            mockDb._queryResult.collect = vi.fn().mockResolvedValue([[{ holder: "testhost:1234:abc123" }]])

            const election = createElection()
            const status = await election.start()

            expect(status).toBe("leader")
            expect(election.isLeader).toBe(true)
            expect(onBecomeLeader).toHaveBeenCalledTimes(1)
            await election.stop()
        })

        it("enters standby when lock is held by another instance", async () => {
            // First call: tryAcquireLock returns empty (lock held by someone else)
            // Second call: getCurrentLeader returns the current holder
            let callCount = 0
            mockDb._queryResult.collect = vi.fn().mockImplementation(() => {
                callCount++
                if (callCount === 1) {
                    return Promise.resolve([[]])
                }
                return Promise.resolve([[{ holder: "otherhost:5678:xyz789" }]])
            })

            const election = createElection()
            const status = await election.start()

            expect(status).toBe("standby")
            expect(election.isLeader).toBe(false)
            expect(onBecomeLeader).not.toHaveBeenCalled()
            await election.stop()
        })

        it("enters standby when query fails", async () => {
            // First call fails (tryAcquireLock), second call for getCurrentLeader succeeds
            let callCount = 0
            mockDb._queryResult.collect = vi.fn().mockImplementation(() => {
                callCount++
                if (callCount === 1) {
                    return Promise.reject(new Error("connection failed"))
                }
                return Promise.resolve([[]])
            })

            const election = createElection()
            const status = await election.start()

            expect(status).toBe("standby")
            expect(election.isLeader).toBe(false)
            await election.stop()
        })
    })

    describe("heartbeat", () => {
        it("refreshes heartbeat at configured interval when leader", async () => {
            mockDb._queryResult.collect = vi.fn().mockResolvedValue([[{ holder: "testhost:1234:abc123" }]])

            const election = createElection({ ingestionLockHeartbeatSeconds: 5, ingestionLockTtlSeconds: 15 })
            await election.start()

            // Reset call count after initial lock acquisition
            mockDb.query.mockClear()
            mockDb._queryResult.collect = vi.fn().mockResolvedValue([[{ holder: "testhost:1234:abc123" }]])

            // Advance past heartbeat interval
            await vi.advanceTimersByTimeAsync(5000)

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining("UPDATE ingestion_lock:leader SET heartbeat = time::now()"),
                expect.objectContaining({ id: "testhost:1234:abc123" }),
            )

            await election.stop()
        })

        it("loses leadership if heartbeat confirms different holder", async () => {
            mockDb._queryResult.collect = vi.fn().mockResolvedValue([[{ holder: "testhost:1234:abc123" }]])

            const election = createElection({ ingestionLockHeartbeatSeconds: 5, ingestionLockTtlSeconds: 15 })
            await election.start()

            // Heartbeat returns empty (lock was taken by someone else)
            mockDb._queryResult.collect = vi.fn().mockResolvedValue([[]])

            await vi.advanceTimersByTimeAsync(5000)

            expect(onLoseLeadership).toHaveBeenCalledTimes(1)
            expect(election.isLeader).toBe(false)
            expect(election.status).toBe("standby")

            await election.stop()
        })
    })

    describe("standby polling", () => {
        it("tries to acquire lock at TTL interval when in standby", async () => {
            // First tryAcquireLock fails (standby), getCurrentLeader returns holder
            let callCount = 0
            mockDb._queryResult.collect = vi.fn().mockImplementation(() => {
                callCount++
                if (callCount === 1) return Promise.resolve([[]])
                if (callCount === 2) return Promise.resolve([[{ holder: "otherhost:5678:xyz789" }]])
                // Subsequent polls succeed (stale lock acquired)
                return Promise.resolve([[{ holder: "testhost:1234:abc123" }]])
            })

            const election = createElection({ ingestionLockTtlSeconds: 10, ingestionLockHeartbeatSeconds: 3 })
            await election.start()
            expect(election.status).toBe("standby")

            // Advance past TTL to trigger standby poll
            await vi.advanceTimersByTimeAsync(10000)

            expect(election.isLeader).toBe(true)
            expect(election.status).toBe("leader")
            expect(onBecomeLeader).toHaveBeenCalledTimes(1)

            await election.stop()
        })
    })

    describe("stop", () => {
        it("releases lock when stopping as leader", async () => {
            mockDb._queryResult.collect = vi.fn().mockResolvedValue([[{ holder: "testhost:1234:abc123" }]])

            const election = createElection()
            await election.start()

            mockDb.query.mockClear()
            mockDb._queryResult.collect = vi.fn().mockResolvedValue([])

            await election.stop()

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining("DELETE FROM ingestion_lock"),
                expect.objectContaining({ id: "testhost:1234:abc123" }),
            )
            expect(election.isLeader).toBe(false)
        })

        it("does not release lock when stopping as standby", async () => {
            let callCount = 0
            mockDb._queryResult.collect = vi.fn().mockImplementation(() => {
                callCount++
                if (callCount === 1) return Promise.resolve([[]])
                return Promise.resolve([[{ holder: "otherhost:5678:xyz789" }]])
            })

            const election = createElection()
            await election.start()
            expect(election.isLeader).toBe(false)

            mockDb.query.mockClear()
            await election.stop()

            // Should not have called DELETE since we're not leader
            expect(mockDb.query).not.toHaveBeenCalled()
        })
    })
})
