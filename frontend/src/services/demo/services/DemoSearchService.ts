import { SearchResults } from "@services/server"

export class DemoSearchService {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    search(query: string, limit = 10): Promise<SearchResults> {
        return Promise.resolve({
            workers: [],
            tasks: [],
        })
    }
}
