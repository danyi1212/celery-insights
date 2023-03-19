type PropertyCountMap = Map<string, Map<string, number>>

export function countUniqueProperties<T>(objects: T[], properties: (keyof T)[]): PropertyCountMap {
    const propertyCountMap: PropertyCountMap = new Map()

    for (const property of properties) {
        const propertyMap: Map<string, number> = new Map()

        for (const object of objects) {
            const value = object[property]

            if (value !== undefined && value !== null) {
                const count = propertyMap.get(value.toString()) ?? 0
                propertyMap.set(value.toString(), count + 1)
            }
        }

        propertyCountMap.set(property.toString(), propertyMap)
    }

    return propertyCountMap
}
