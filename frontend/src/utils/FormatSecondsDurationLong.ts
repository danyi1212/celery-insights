import { formatDistanceStrict } from "date-fns"

export const formatSecondsDurationLong = (seconds: number): string =>
    formatDistanceStrict(new Date(0), new Date(seconds * 1000), { addSuffix: false })
