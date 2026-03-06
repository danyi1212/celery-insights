import { Surreal } from "surrealdb"
import { hostname } from "node:os"
import type { Config } from "./config"
import type { Logger } from "./logger"
import { bunLogger } from "./logger"

export type IngestionStatus = "leader" | "standby" | "read-only" | "disabled"

export interface LeaderElectionOptions {
    db: Surreal
    config: Config
    instanceId: string
    onBecomeLeader: () => void
    onLoseLeadership: () => void
    logger?: Logger
}

export function generateInstanceId(): string {
    const host = hostname()
    const pid = process.pid
    const suffix = Math.random().toString(36).slice(2, 8)
    return `${host}:${pid}:${suffix}`
}

/**
 * Manages ingestion leader election using a SurrealDB lock record.
 *
 * Only one instance should run the ingestion pipeline at a time.
 * Uses an atomic UPDATE with conditions to avoid TOCTOU races.
 */
export class LeaderElection {
    private db: Surreal
    private config: Config
    private instanceId: string
    private onBecomeLeader: () => void
    private onLoseLeadership: () => void
    private log: Logger
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null
    private standbyTimer: ReturnType<typeof setInterval> | null = null
    private _isLeader = false
    private _status: IngestionStatus = "disabled"
    private stopped = false

    constructor(options: LeaderElectionOptions) {
        this.db = options.db
        this.config = options.config
        this.instanceId = options.instanceId
        this.onBecomeLeader = options.onBecomeLeader
        this.onLoseLeadership = options.onLoseLeadership
        this.log = options.logger ?? bunLogger
    }

    get isLeader(): boolean {
        return this._isLeader
    }

    get status(): IngestionStatus {
        return this._status
    }

    /**
     * Start the leader election process.
     * Returns the initial status after the first election attempt.
     */
    async start(): Promise<IngestionStatus> {
        if (!this.config.ingestionEnabled) {
            this._status = "read-only"
            this.log.info("Ingestion disabled — read-only mode")
            return this._status
        }

        if (!this.config.ingestionLeaderElection) {
            this._isLeader = true
            this._status = "leader"
            this.log.info("Leader election disabled — assuming leader role")
            this.onBecomeLeader()
            return this._status
        }

        const acquired = await this.tryAcquireLock()
        if (acquired) {
            this.promoteToLeader()
        } else {
            await this.enterStandby()
        }

        return this._status
    }

    /**
     * Stop the leader election, release the lock if held, and clear all timers.
     */
    async stop(): Promise<void> {
        this.stopped = true
        this.clearTimers()

        if (this._isLeader) {
            await this.releaseLock()
            this._isLeader = false
            this._status = "disabled"
        }
    }

    /**
     * Attempt to atomically acquire the ingestion lock.
     *
     * The UPDATE succeeds (returns a record) only if:
     * - No lock exists yet (upsert)
     * - We already hold the lock (re-acquire)
     * - The existing lock is stale (heartbeat expired)
     */
    private async tryAcquireLock(): Promise<boolean> {
        try {
            const [result] = await this.db
                .query<[{ holder: string }[]]>(
                    `UPSERT ingestion_lock:leader SET
                        holder = $id,
                        acquired_at = time::now(),
                        heartbeat = time::now(),
                        ttl_seconds = $ttl
                    WHERE
                        holder = NONE
                        OR holder = $id
                        OR heartbeat < time::now() - $ttl * 1s`,
                    {
                        id: this.instanceId,
                        ttl: this.config.ingestionLockTtlSeconds,
                    },
                )
                .collect<[{ holder: string }[]]>()

            if (result && result.length > 0 && result[0].holder === this.instanceId) {
                return true
            }

            return false
        } catch (err) {
            this.log.error(`Failed to acquire ingestion lock: ${err}`)
            return false
        }
    }

    private promoteToLeader(): void {
        this._isLeader = true
        this._status = "leader"
        this.clearTimers()
        this.log.info(`Leader elected — instance ${this.instanceId} is ingesting`)
        this.startHeartbeat()
        this.onBecomeLeader()
    }

    private async enterStandby(): Promise<void> {
        this._isLeader = false
        this._status = "standby"
        this.clearTimers()

        const currentLeader = await this.getCurrentLeader()
        this.log.info(`Standby mode — instance ${currentLeader ?? "unknown"} is ingesting`)

        this.startStandbyPolling()
    }

    private startHeartbeat(): void {
        this.heartbeatTimer = setInterval(async () => {
            if (this.stopped) return
            try {
                const [result] = await this.db
                    .query<
                        [{ holder: string }[]]
                    >(`UPDATE ingestion_lock:leader SET heartbeat = time::now() WHERE holder = $id`, { id: this.instanceId })
                    .collect<[{ holder: string }[]]>()

                if (!result || result.length === 0 || result[0].holder !== this.instanceId) {
                    this.log.warn("Lost ingestion lock — another instance may have taken over")
                    this._isLeader = false
                    this.clearTimers()
                    this.onLoseLeadership()
                    await this.enterStandby()
                }
            } catch (err) {
                this.log.error(`Failed to refresh heartbeat: ${err}`)
            }
        }, this.config.ingestionLockHeartbeatSeconds * 1000)
    }

    private startStandbyPolling(): void {
        this.standbyTimer = setInterval(async () => {
            if (this.stopped) return
            const acquired = await this.tryAcquireLock()
            if (acquired) {
                this.log.info("Promoted to leader — starting ingestion")
                this.promoteToLeader()
            }
        }, this.config.ingestionLockTtlSeconds * 1000)
    }

    private async releaseLock(): Promise<void> {
        try {
            await this.db
                .query(`DELETE FROM ingestion_lock WHERE id = ingestion_lock:leader AND holder = $id`, {
                    id: this.instanceId,
                })
                .collect()
            this.log.info("Released ingestion lock")
        } catch (err) {
            this.log.error(`Failed to release ingestion lock: ${err}`)
        }
    }

    private async getCurrentLeader(): Promise<string | null> {
        try {
            const [result] = await this.db
                .query<[{ holder: string }[]]>(`SELECT holder FROM ingestion_lock:leader`)
                .collect<[{ holder: string }[]]>()
            if (result && result.length > 0) {
                return result[0].holder
            }
            return null
        } catch {
            return null
        }
    }

    private clearTimers(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer)
            this.heartbeatTimer = null
        }
        if (this.standbyTimer) {
            clearInterval(this.standbyTimer)
            this.standbyTimer = null
        }
    }
}
