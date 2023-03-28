export const formatDurationExact = (duration: number): string => {
    const minutes = Math.floor(duration / 60_000)
    const seconds = Math.floor((duration % 60_000) / 1000)
    const ms = duration % 1000
    if (minutes) return `${minutes}min, ${seconds}.${ms}s`
    else if (seconds) return `${seconds}.${ms}s`
    else return `${ms}ms`
}
