import { test, expect } from "../fixtures/base"

const BASE_URL = "http://localhost:8555"

test.describe("Prometheus Metrics", () => {
    test("GET /metrics returns Prometheus text format with core metrics", async ({ request }) => {
        const res = await request.get(`${BASE_URL}/metrics`)
        expect(res.status()).toBe(200)
        expect(res.headers()["content-type"]).toContain("text/plain")

        const body = await res.text()

        // Core gauges must be present
        expect(body).toContain("celery_tasks_total")
        expect(body).toContain("celery_tasks_by_state")
        expect(body).toContain("celery_workers_total")
        expect(body).toContain("celery_workers_online")
        expect(body).toContain("celery_workers_offline")
        expect(body).toContain("celery_tasks_succeeded_total")
        expect(body).toContain("celery_tasks_failed_total")
        expect(body).toContain("celery_tasks_retried_total")

        // Histogram must have standard suffixes
        expect(body).toContain("celery_task_runtime_seconds_bucket")
        expect(body).toContain("celery_task_runtime_seconds_count")
        expect(body).toContain("celery_task_runtime_seconds_sum")

        // Should NOT contain verbose-only metrics
        expect(body).not.toContain("celery_tasks_by_type")
        expect(body).not.toContain("celery_tasks_by_worker")
    })

    test("GET /metrics/verbose returns core + detailed metrics", async ({ request }) => {
        const res = await request.get(`${BASE_URL}/metrics/verbose`)
        expect(res.status()).toBe(200)
        expect(res.headers()["content-type"]).toContain("text/plain")

        const body = await res.text()

        // Core metrics still present
        expect(body).toContain("celery_tasks_total")
        expect(body).toContain("celery_task_runtime_seconds_bucket")

        // Verbose-only metrics
        expect(body).toContain("celery_tasks_by_type")
        expect(body).toContain("celery_tasks_by_worker")
        expect(body).toContain("celery_exceptions_by_type")
        expect(body).toContain("celery_worker_active_tasks")
        expect(body).toContain("celery_worker_processed_tasks")
    })

    test("GET /metrics/system returns internal metrics", async ({ request }) => {
        const res = await request.get(`${BASE_URL}/metrics/system`)
        expect(res.status()).toBe(200)
        expect(res.headers()["content-type"]).toContain("text/plain")

        const body = await res.text()

        expect(body).toContain("celery_insights_uptime_seconds")
        expect(body).toContain("celery_insights_memory_rss_bytes")
        expect(body).toContain("celery_insights_db_tasks_count")
        expect(body).toContain("celery_insights_db_workers_count")
        expect(body).toContain("celery_insights_db_events_count")

        // Ingester stats should be present when ingestion is active
        expect(body).toContain("celery_insights_events_ingested_total")
        expect(body).toContain("celery_insights_flushes_total")
        expect(body).toContain("celery_insights_buffer_size")
        expect(body).toContain("celery_insights_queue_size")
    })

    test("metrics values are populated after task execution", async ({ request, scenario, waitForTask }) => {
        const { task_id } = await scenario.triggerScenario("add")
        await waitForTask(task_id, ["SUCCESS"])

        // Poll /metrics until the succeeded task is reflected
        await expect(async () => {
            const res = await request.get(`${BASE_URL}/metrics`)
            const body = await res.text()

            // At least one task should exist
            const totalMatch = body.match(/celery_tasks_total (\d+\.?\d*)/)
            expect(totalMatch).toBeTruthy()
            expect(parseFloat(totalMatch![1])).toBeGreaterThan(0)

            // At least one succeeded task
            const succeededMatch = body.match(/celery_tasks_succeeded_total (\d+\.?\d*)/)
            expect(succeededMatch).toBeTruthy()
            expect(parseFloat(succeededMatch![1])).toBeGreaterThan(0)
        }).toPass({ timeout: 15_000 })
    })
})
