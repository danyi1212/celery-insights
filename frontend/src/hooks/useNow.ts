import { useEffect, useState } from "react"

export const useNow = (interval?: number): Date => {
    const [now, setNow] = useState(new Date())

    useEffect(() => {
        if (interval) {
            const token = setInterval(() => setNow(new Date()), interval)
            return () => clearInterval(token)
        }
    }, [interval])

    return now
}
