import { useMemo } from "react"
import { useLiveQuery } from "./use-live-query"
import { extractId, type SurrealTask } from "@/types/surreal-records"

const byLastUpdatedDesc = (a: SurrealTask, b: SurrealTask) =>
    new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()

export interface FailureInboxItem {
    key: string
    taskId: string
    taskType: string
    exception: string
    preview: string
    count: number
    latestAt: string
}

const normalizePreview = (task: SurrealTask) => {
    const preview = (task.result || task.traceback || "").split("\n")[0]?.trim() || ""
    if (preview && preview !== task.exception) return preview
    return ""
}

export const useFailureInbox = (limit = 7) => {
    const result = useLiveQuery<SurrealTask>({
        initialQuery:
            "SELECT * FROM task WHERE state = 'FAILURE' OR exception != NONE ORDER BY last_updated DESC LIMIT 100",
        liveTable: "task",
        orderBy: byLastUpdatedDesc,
        filter: (task) => task.state === "FAILURE" || Boolean(task.exception),
        limit: 100,
    })

    const groups = useMemo<FailureInboxItem[]>(() => {
        const grouped = new Map<string, FailureInboxItem>()

        for (const task of result.data) {
            const taskType = task.type || "Unknown task"
            const exception = task.exception || "Task failure"
            const key = `${taskType}::${exception}`
            const existing = grouped.get(key)

            if (existing) {
                existing.count += 1
                continue
            }

            grouped.set(key, {
                key,
                taskId: extractId(task.id),
                taskType,
                exception,
                preview: normalizePreview(task),
                count: 1,
                latestAt: task.last_updated,
            })
        }

        return [...grouped.values()].sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())
    }, [result.data])

    return {
        ...result,
        groups: groups.slice(0, limit),
    }
}
