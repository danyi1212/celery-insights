import { useCallback, useEffect, useState } from "react"
import { useSurrealDB } from "@components/surrealdb-provider"
import { parseTask, type SurrealTask, type Task } from "@/types/surreal-records"

export const useTaskCandidates = (taskType?: string) => {
    const { db, status } = useSurrealDB()
    const [candidates, setCandidates] = useState<Task[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const loadCandidates = useCallback(async () => {
        if (status !== "connected") return
        setIsLoading(true)
        try {
            let query: string
            let bindings: Record<string, unknown>
            if (taskType) {
                query = "SELECT * FROM task WHERE type = $type ORDER BY last_updated DESC LIMIT 20"
                bindings = { type: taskType }
            } else {
                query = "SELECT * FROM task ORDER BY last_updated DESC LIMIT 20"
                bindings = {}
            }
            const [result] = await db.query<[SurrealTask[]]>(query, bindings)
            const tasks = Array.isArray(result) ? result : []
            setCandidates(tasks.map(parseTask))
        } catch {
            setCandidates([])
        } finally {
            setIsLoading(false)
        }
    }, [db, status, taskType])

    useEffect(() => {
        loadCandidates()
    }, [loadCandidates])

    return { candidates, isLoading }
}
