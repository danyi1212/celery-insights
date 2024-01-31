import ListSkeleton from "@components/common/ListSkeleton"
import ErrorAlert from "@components/errors/ErrorAlert"
import SearchResultListItem from "@components/search/SearchResultListItem"
import TaskAvatar from "@components/task/TaskAvatar"
import { useClient } from "@hooks/useClient"
import StorageIcon from "@mui/icons-material/Storage"
import Avatar from "@mui/material/Avatar"
import List from "@mui/material/List"
import Typography from "@mui/material/Typography"
import { SearchResults } from "@services/server"
import useSettingsStore from "@stores/useSettingsStore"
import { format } from "date-fns"
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
        setError(false)
        if (query) {
            const token = setTimeout(() => {
                client.search
                    .search(query)
                    .then((results) => setResults(results))
                    .catch((error) => setError(error))
                    .finally(() => setLoading(false))
            }, debounce)
            return () => clearTimeout(token)
        }
    }, [query, client])

    if (isDemo) {
        return <Typography align="center">Sorry, search is not available in Demo Mode.</Typography>
    }
    if (loading) {
        return <ListSkeleton count={5} dense />
    }
    if (error) {
        return <ErrorAlert error={error} />
    }
    if (results.workers.length === 0 && results.tasks.length === 0) {
        return <Typography align="center">Sorry, we found no tasks or workers matching your search.</Typography>
    }

    return (
        <List sx={{ width: "100%" }} dense>
            {results.workers.map((worker, index) => (
                <SearchResultListItem
                    key={index}
                    primary={worker.hostname}
                    secondary={`PID ${worker.pid}`}
                    link={`/workers/${worker.id}`}
                    avatar={
                        <Avatar>
                            <StorageIcon />
                        </Avatar>
                    }
                />
            ))}
            {results.tasks.map((task, index) => (
                <SearchResultListItem
                    key={index}
                    primary={task?.type || "Unknown"}
                    secondary={"Sent at " + format(task.sent_at, "HH:mm:ss")}
                    link={`/tasks/${task.id}`}
                    avatar={<TaskAvatar taskId={task.id} type={task.type} status={task.state} />}
                />
            ))}
        </List>
    )
}
export default SearchResultList
