import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"

type TaskFilter = Map<string, Set<string>>

export const useExplorerFilter = (): [TaskFilter, (key: string, values: Set<string>) => void] => {
    const [filters, setFilters] = useState<TaskFilter>(new Map())
    const [searchParams, setSearchParams] = useSearchParams()

    useEffect(() => {
        const filterParams: URLSearchParams = new URLSearchParams()
        for (const [key, values] of filters) for (const value of values) filterParams.append(key, value)

        setSearchParams(filterParams, { replace: true })
    }, [filters, setSearchParams])

    useEffect(
        () => {
            const newFilters: TaskFilter = new Map()
            Object.entries(searchParams).forEach(([key, value]) => {
                if (!newFilters.has(key)) newFilters.set(key, new Set())
                newFilters.get(key)?.add(value as string)
            })
            setFilters(newFilters)
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    )

    const setFilter = useCallback(
        (key: string, values: Set<string>) => setFilters((filters) => new Map(filters).set(key, values)),
        [setFilters]
    )

    return [filters, setFilter]
}
