const hexToRgb = (hex: string): number[] => {
    const match = hex.match(/[A-Za-z0-9]{2}/g)
    if (!match) {
        throw new Error(`Invalid hex color: ${hex}`)
    }
    return match.map((v) => parseInt(v, 16))
}
export const getBrightness = (color: string): number => {
    const [r, g, b] = hexToRgb(color)

    // Calculate the brightness using the relative luminance formula
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return Math.round((l / 255) * 100)
}
