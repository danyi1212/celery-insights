import { useEffect, useState } from "react"

export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false)

    useEffect(() => {
        const mql = window.matchMedia(query)
        const onChange = () => setMatches(mql.matches)
        mql.addEventListener("change", onChange)
        setMatches(mql.matches)
        return () => mql.removeEventListener("change", onChange)
    }, [query])

    return matches
}
