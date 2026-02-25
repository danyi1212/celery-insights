import ListSkeleton from "@components/common/list-skeleton"
import ErrorAlert from "@components/errors/error-alert"
import SearchResultListItem from "@components/search/search-result-list-item"
import TaskAvatar from "@components/task/task-avatar"
import { Avatar, AvatarFallback } from "@components/ui/avatar"
import { useSearch } from "@hooks/use-search"
import { TaskState } from "@services/server"
import useSettingsStore from "@stores/use-settings-store"
import { extractId } from "@utils/translate-server-models"
import { format } from "date-fns"
import { Server } from "lucide-react"
import React from "react"

interface SearchResultsProps {
    query: string
}

const SearchResultList: React.FC<SearchResultsProps> = ({ query }) => {
    const isDemo = useSettingsStore((state) => state.demo)
    const { tasks, workers, isLoading, error } = useSearch(query)

    if (isDemo) {
        return (
            <p className="text-center text-sm text-muted-foreground py-4">
                Sorry, search is not available in Demo Mode.
            </p>
        )
    }
    if (isLoading) {
        return <ListSkeleton count={5} />
    }
    if (error) {
        return <ErrorAlert error={error} />
    }
    if (workers.length === 0 && tasks.length === 0) {
        return (
            <p className="text-center text-sm text-muted-foreground py-4">
                Sorry, we found no tasks or workers matching your search.
            </p>
        )
    }

    return (
        <ul className="w-full py-1">
            {workers.map((worker) => {
                const workerId = extractId(worker.id)
                return (
                    <SearchResultListItem
                        key={workerId}
                        primary={worker.hostname || workerId}
                        secondary={`PID ${worker.pid ?? "Unknown"}`}
                        link={`/workers/${workerId}`}
                        avatar={
                            <Avatar>
                                <AvatarFallback>
                                    <Server className="size-4" />
                                </AvatarFallback>
                            </Avatar>
                        }
                    />
                )
            })}
            {tasks.map((task) => {
                const taskId = extractId(task.id)
                const sentAtDate = task.sent_at ? new Date(task.sent_at) : null
                const sentAt =
                    sentAtDate && !Number.isNaN(sentAtDate.getTime())
                        ? format(sentAtDate, "HH:mm:ss")
                        : "Unknown"
                return (
                    <SearchResultListItem
                        key={taskId}
                        primary={task?.type || "Unknown"}
                        secondary={`Sent at ${sentAt}`}
                        link={`/tasks/${taskId}`}
                        avatar={
                            <TaskAvatar taskId={taskId} type={task.type} status={task.state as TaskState} />
                        }
                    />
                )
            })}
        </ul>
    )
}
export default SearchResultList
