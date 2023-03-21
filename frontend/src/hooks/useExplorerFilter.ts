import { useCallback, useEffect, useState } from "react"

type TaskFilter = Map<string, Set<string>>

const getQueryFilters = (): TaskFilter => {
    const filters: TaskFilter = new Map()
    const searchParams = new URLSearchParams(window.location.search)
    for (const [key, value] of searchParams.entries()) {
        if (!filters.has(key)) filters.set(key, new Set())
        filters.get(key)?.add(value as string)
    }
    return filters
}

export const useExplorerFilter = (): [TaskFilter, (key: string, values: Set<string>) => void] => {
    const [filters, setFilters] = useState<TaskFilter>(getQueryFilters())

    useEffect(() => {
        const filterParams: URLSearchParams = new URLSearchParams()
        for (const [key, values] of filters) for (const value of values) filterParams.append(key, value)
        const filterString = filterParams.toString()
        const queryParams = filterString ? "?" + filterString : window.location.pathname
        history.replaceState(null, "", queryParams)
    }, [filters])

    const setFilter = useCallback(
        (key: string, values: Set<string>) => setFilters((filters) => new Map(filters).set(key, values)),
        [setFilters]
    )

    return [filters, setFilter]
}
