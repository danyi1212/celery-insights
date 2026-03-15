import { useCallback, useEffect, useRef, useState } from "react"
import { useSurrealDB } from "@components/surrealdb-provider"
import type { SurrealTask, SurrealWorker } from "@/types/surreal-records"

export interface SearchTaskResult extends SurrealTask {
  workflow?: {
    aggregate_state?: string | null
    root_task_type?: string | null
    task_count?: number | null
  } | null
}

const DEBOUNCE_MS = 300

export interface SearchResult {
  tasks: SearchTaskResult[]
  workers: SurrealWorker[]
}

/**
 * Search hook — queries SurrealDB directly for tasks and workers matching
 * a search string. Input is debounced by 300ms to avoid excessive queries.
 *
 * Searches tasks by id, type, and exception; workers by id.
 * Uses string::contains with string::lowercase for case-insensitive matching.
 */
export const useSearch = (query: string, limit = 10) => {
  const { db, status } = useSurrealDB()

  const [data, setData] = useState<SearchResult>({ tasks: [], workers: [] })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeQueryRef = useRef<string>("")

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setData({ tasks: [], workers: [] })
        setIsLoading(false)
        return
      }

      try {
        const [tasks, workers] = await db.query<[SearchTaskResult[], SurrealWorker[]]>(
          `SELECT *,
                        (SELECT root_task_type, aggregate_state, task_count FROM workflow WHERE id = type::record('workflow', workflow_id))[0] AS workflow
                    FROM task WHERE
                        string::contains(string::lowercase(string::concat("", id)), $q)
                        OR string::contains(string::lowercase(type ?? ''), $q)
                        OR string::contains(string::lowercase(exception ?? ''), $q)
                    ORDER BY last_updated DESC LIMIT $limit;
                    SELECT * FROM worker WHERE
                        string::contains(string::lowercase(string::concat("", id)), $q)
                    ORDER BY last_updated DESC LIMIT $limit;`,
          { q: q.toLowerCase(), limit },
        )

        // Only update if this is still the active query
        if (activeQueryRef.current === q) {
          setData({
            tasks: Array.isArray(tasks) ? tasks : [],
            workers: Array.isArray(workers) ? workers : [],
          })
          setError(null)
        }
      } catch (err) {
        if (activeQueryRef.current === q) {
          setError(err instanceof Error ? err : new Error(String(err)))
        }
      } finally {
        if (activeQueryRef.current === q) {
          setIsLoading(false)
        }
      }
    },
    [db, limit],
  )

  useEffect(() => {
    if (status !== "connected") return

    activeQueryRef.current = query

    if (!query.trim()) {
      setData({ tasks: [], workers: [] })
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runSearch(query)
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, status, runSearch])

  return { ...data, isLoading, error }
}
