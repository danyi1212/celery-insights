export function formatBytes(bytes: number, digits = 2): string {
    if (bytes < 1024) {
        return bytes + " B"
    } else if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(digits) + " KB"
    } else if (bytes < 1024 * 1024 * 1024) {
        return (bytes / (1024 * 1024)).toFixed(digits) + " MB"
    } else {
        return (bytes / (1024 * 1024 * 1024)).toFixed(digits) + " GB"
    }
}
