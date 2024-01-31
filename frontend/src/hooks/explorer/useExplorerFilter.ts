import { useCallback, useEffect, useState } from "react"

export type TaskFilter<T> = Map<keyof T, Set<string>>

const getQueryFilters = <T>(): TaskFilter<T> => {
    const filters: TaskFilter<T> = new Map()
    const searchParams = new URLSearchParams(window.location.search)
    for (const [k, value] of searchParams.entries()) {
        const key = k as keyof T
        if (!filters.has(key)) filters.set(key, new Set())
        filters.get(key)?.add(value as string)
    }
    return filters
}

export const useExplorerFilter = <T>(): [TaskFilter<T>, (key: keyof T, values: Set<string>) => void] => {
    const [filters, setFilters] = useState<TaskFilter<T>>(getQueryFilters())

    useEffect(() => {
        const filterParams: URLSearchParams = new URLSearchParams()
        for (const [key, values] of filters) for (const value of values) filterParams.append(key as string, value)
        const filterString = filterParams.toString()
        const queryParams = filterString ? "?" + filterString : window.location.pathname
        history.replaceState(null, "", queryParams)
    }, [filters])

    const setFilter = useCallback(
        (key: keyof T, values: Set<string>) => setFilters((filters) => new Map(filters).set(key, values)),
        [setFilters],
    )

    return [filters, setFilter]
}
