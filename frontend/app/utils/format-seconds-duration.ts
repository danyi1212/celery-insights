export const formatSecondsDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    let formattedDuration = ""
    if (minutes > 0) {
        formattedDuration += `${minutes}min `
    }
    if (remainingSeconds > 0 || formattedDuration === "") {
        formattedDuration += `${remainingSeconds}s`
    }
    return formattedDuration
}
