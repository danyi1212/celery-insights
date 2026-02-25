import ListSkeleton from "@components/common/list-skeleton"
import ErrorAlert from "@components/errors/error-alert"
import SearchResultListItem from "@components/search/search-result-list-item"
import TaskAvatar from "@components/task/task-avatar"
import { useClient } from "@hooks/use-client"
import { Avatar, AvatarFallback } from "@components/ui/avatar"
import { SearchResults } from "@services/server"
import useSettingsStore from "@stores/use-settings-store"
import { format } from "date-fns"
import { Server } from "lucide-react"
import React, { useEffect, useState } from "react"

interface SearchResultsProps {
    query: string
}

const debounce = 500
const SearchResultList: React.FC<SearchResultsProps> = ({ query }) => {
    const client = useClient()
    const isDemo = useSettingsStore((state) => state.demo)
    const [results, setResults] = useState<SearchResults>({ tasks: [], workers: [] })
    const [error, setError] = useState<unknown | null>(null)
    const [loading, setLoading] = useState<boolean>(false)

    useEffect(() => {
        setLoading(true)
        setError(null)
        if (query) {
            const token = setTimeout(() => {
                client.search
                    .search(query)
                    .then((results) => setResults(results))
                    .catch((error) => setError(error))
                    .finally(() => setLoading(false))
            }, debounce)
            return () => clearTimeout(token)
        } else {
            setLoading(false)
            setResults({ tasks: [], workers: [] })
        }
    }, [query, client])

    if (isDemo) {
        return (
            <p className="text-center text-sm text-muted-foreground py-4">
                Sorry, search is not available in Demo Mode.
            </p>
        )
    }
    if (loading) {
        return <ListSkeleton count={5} />
    }
    if (error) {
        return <ErrorAlert error={error} />
    }
    if (results.workers.length === 0 && results.tasks.length === 0) {
        return (
            <p className="text-center text-sm text-muted-foreground py-4">
                Sorry, we found no tasks or workers matching your search.
            </p>
        )
    }

    return (
        <ul className="w-full py-1">
            {results.workers.map((worker) => (
                <SearchResultListItem
                    key={worker.id}
                    primary={worker.hostname}
                    secondary={`PID ${worker.pid}`}
                    link={`/workers/${worker.id}`}
                    avatar={
                        <Avatar>
                            <AvatarFallback>
                                <Server className="size-4" />
                            </AvatarFallback>
                        </Avatar>
                    }
                />
            ))}
            {results.tasks.map((task) => (
                <SearchResultListItem
                    key={task.id}
                    primary={task?.type || "Unknown"}
                    secondary={"Sent at " + format(task.sent_at * 1000, "HH:mm:ss")}
                    link={`/tasks/${task.id}`}
                    avatar={<TaskAvatar taskId={task.id} type={task.type} status={task.state} />}
                />
            ))}
        </ul>
    )
}
export default SearchResultList
