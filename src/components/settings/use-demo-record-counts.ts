import { useQuery } from "@tanstack/react-query"
import { useSurrealDB } from "@components/surrealdb-provider"

type DemoRecordCounts = {
  tasks: number
  events: number
  workers: number
}

const readCount = (result: unknown): number => {
  if (Array.isArray(result) && result.length > 0) {
    const first = result[0]
    if (first && typeof first === "object" && "count" in first) {
      const value = (first as { count?: unknown }).count
      return typeof value === "number" ? value : 0
    }
    if (Array.isArray(first) && first.length > 0) {
      const nested = first[0]
      if (nested && typeof nested === "object" && "count" in nested) {
        const value = (nested as { count?: unknown }).count
        return typeof value === "number" ? value : 0
      }
    }
  }
  return 0
}

export const useDemoRecordCounts = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const { db, status } = useSurrealDB()

  return useQuery({
    queryKey: ["demo-settings-counts"],
    enabled: enabled && status === "connected",
    staleTime: 1_000,
    queryFn: async (): Promise<DemoRecordCounts> => {
      const [tasksResult, eventsResult, workersResult] = await db.query<[unknown, unknown, unknown]>(
        "SELECT count() AS count FROM task GROUP ALL;" +
          "SELECT count() AS count FROM event GROUP ALL;" +
          "SELECT count() AS count FROM worker GROUP ALL;",
      )

      return {
        tasks: readCount(tasksResult),
        events: readCount(eventsResult),
        workers: readCount(workersResult),
      }
    },
  })
}
