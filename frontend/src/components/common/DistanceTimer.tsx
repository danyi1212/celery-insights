import { useNow } from "@hooks/useNow"
import Typography from "@mui/material/Typography"
import { differenceInDays, differenceInHours, differenceInMinutes, formatDistanceStrict } from "date-fns"
import React, { useMemo } from "react"

interface TimeSinceProps {
    time: Date
    addSuffix?: boolean
    unit?: "second" | "minute" | "hour" | "day" | "month" | "year"
    roundingMethod?: "floor" | "ceil" | "round"
    locale?: Locale
}

const TimeSince: React.FC<TimeSinceProps> = ({ time, addSuffix, unit, roundingMethod, locale }) => {
    // Determine the update interval based on the difference between now and the time
    const interval = useMemo(() => {
        const now = new Date()
        const diffInMinutes = differenceInMinutes(now, time)
        const diffInHours = differenceInHours(now, time)
        const diffInDays = differenceInDays(now, time)

        if (diffInMinutes < 1) return 1000 // update every 1s if less than 1 minute
        else if (diffInHours < 1) return 60 * 1000 // update every 1m if less than 1 hour
        else if (diffInDays < 1) return 60 * 60 * 1000 // update every 1h if less than 1 day
        else return 24 * 60 * 60 * 1000 // update every 1d if more than 1 day
    }, [time])

    const now = useNow(interval)

    const text = useMemo(() => formatDistanceStrict(time, now, { addSuffix, unit, roundingMethod, locale }), [now])
    return <Typography component="span">{text}</Typography>
}

export default TimeSince
